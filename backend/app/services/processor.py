from sqlalchemy.orm import Session
from app.models.user import File, Chunk, Embedding
from app.services.chunker import chunk_text
from app.services.embeddings import get_embedding
from app.services.vectordb import add_embedding

def process_file(db: Session, file: File):
    if not file.extracted_text:
        return
    
    chunks = chunk_text(file.extracted_text)
    
    for idx, text in enumerate(chunks):
        chunk_record = Chunk(
            file_id=file.id,
            content=text,
            chunk_index=idx
        )
        db.add(chunk_record)
        db.commit()
        db.refresh(chunk_record)
        
        embedding_vector = get_embedding(text)
        if embedding_vector:
            embedding_record = Embedding(
                chunk_id=chunk_record.id,
                embedding_vector=str(embedding_vector)
            )
            db.add(embedding_record)
            db.commit()
            
            add_embedding(
                chunk_id=chunk_record.id,
                text=text,
                embedding=embedding_vector,
                metadata={"file_id": file.id, "filename": file.filename}
            )
