import os
import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer

EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
MAX_TOKENS      = 256  # sentence-transformers' max_seq_length for all-MiniLM-L6-v2

_model = None


class OnnxEmbeddings:
    """
    Same model and output as HuggingFaceEmbeddings(normalize_embeddings=True),
    run with ONNX Runtime instead of PyTorch so the app fits in Render's 512 MB
    (~240 MB instead of ~485 MB). Mean-pooled, L2-normalised 384-dim vectors,
    so rows already stored in pgvector stay valid.
    """

    def __init__(self, model_name: str):
        repo = model_name if "/" in model_name else f"sentence-transformers/{model_name}"
        tokenizer_path = hf_hub_download(repo, "tokenizer.json", cache_dir="/tmp/hf_cache")
        model_path     = hf_hub_download(repo, "onnx/model.onnx", cache_dir="/tmp/hf_cache")

        self.tokenizer = Tokenizer.from_file(tokenizer_path)
        self.tokenizer.enable_truncation(max_length=MAX_TOKENS)
        self.tokenizer.enable_padding()

        options = ort.SessionOptions()
        options.enable_cpu_mem_arena = False  # don't keep peak buffers around between calls
        self.session = ort.InferenceSession(model_path, options, providers=["CPUExecutionProvider"])
        self.inputs  = {i.name for i in self.session.get_inputs()}

    def embed_documents(self, texts: list) -> list:
        encodings = self.tokenizer.encode_batch(texts)
        ids  = np.array([e.ids for e in encodings], dtype=np.int64)
        mask = np.array([e.attention_mask for e in encodings], dtype=np.int64)
        feed = {"input_ids": ids, "attention_mask": mask}
        if "token_type_ids" in self.inputs:
            feed["token_type_ids"] = np.zeros_like(ids)

        hidden  = self.session.run(None, feed)[0]                      # (batch, tokens, 384)
        weights = mask[..., None].astype(np.float32)
        pooled  = (hidden * weights).sum(axis=1) / np.clip(weights.sum(axis=1), 1e-9, None)
        pooled /= np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12, None)
        return pooled.tolist()

    def embed_query(self, text: str) -> list:
        return self.embed_documents([text])[0]


def get_embedding_model():
    global _model
    if _model is None:
        _model = OnnxEmbeddings(EMBEDDING_MODEL)
    return _model
