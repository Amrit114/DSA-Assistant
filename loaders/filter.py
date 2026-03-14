from loaders.hasher import get_file_hash


def filter_new_files(pdf_files: list, already_ingested: dict) -> tuple:
    """
    Checks each PDF file against already ingested files in DB.

    Returns:
        new_files_paths  — list of Path objects to process
        skipped_files    — list of filenames already in DB
    """
    new_files_paths = []
    skipped_files   = []

    for pdf_file in pdf_files:
        filename  = pdf_file.name
        file_hash = get_file_hash(str(pdf_file))

        if filename in already_ingested and already_ingested[filename] == file_hash:
            print(f"Skipping (already ingested): {filename}")
            skipped_files.append(filename)
        else:
            print(f"Processing: {filename}")
            new_files_paths.append(pdf_file)

    return new_files_paths, skipped_files