MINDVAULT -

PHASE 1: MVP (CORE FUNCTIONALITY) - LOCAL FILE UPLOAD FIRST
Duration: 2 weeks
Goal: Prove RAG works with local file uploads before integrating external sources

What we build:

- User login/signup
- Upload documents (PDF, DOCX, XLSX, TXT)
- Index uploaded files locally
- Ask questions about uploaded docs
- Show citations from uploaded docs
- THEN add Google Drive integration at end

What we DON'T build:

- Slack, Notion, Dropbox integration (Phase 2)
- Caching or optimization (Phase 3)
- Advanced features
- Mobile UI
- Team collaboration

Success metric: Upload 3 docs, ask questions, get accurate answers with sources

SUBTASKS PHASE 1:

1.1 Project Setup & Database
─────────────────────────────
What: Initialize Next.js frontend, FastAPI backend, PostgreSQL

Steps:

1. Create frontend: npx create-next-app@latest mindvault-frontend
2. Create backend: mkdir mindvault-backend, setup FastAPI app
3. Create PostgreSQL DB (Railway or local)
4. Install dependencies (see requirements below)
5. Create .env files for both frontend and backend
6. Test both apps run locally

Frontend .env.local:
NEXT_PUBLIC_API_URL=http://localhost:8000

Backend .env:
DATABASE_URL=postgresql://user:pass@localhost/mindvault
MISTRAL_API_KEY=your_mistral_key
JWT_SECRET=your_secret_key_here

Time: 2 hours
Commit: [ADD] initialized Next.js frontend and FastAPI backend

1.2 Database Schema & Models
────────────────────────────
What: Create tables for users, files, chunks, citations

Tables needed:

- users (id, email, password_hash, created_at)
- files (id, user_id, filename, file_path, file_type, file_size, uploaded_at)
- chunks (id, file_id, content, chunk_index, page_number, created_at)
- embeddings (id, chunk_id, embedding_vector, created_at)
- chat_history (id, user_id, question, answer, created_at)
- citations (id, chat_id, chunk_id, file_id, confidence_score)

Create with:

- SQLAlchemy ORM (Python)
- Use PostgreSQL

Time: 2 hours
Commit: [ADD] created database schema for users, files, chunks, embeddings

1.3 User Authentication
───────────────────────
What: Signup, login, JWT tokens

Frontend:

- Signup page (/signup)
- Login page (/login)
- Redirect to dashboard after login
- Save JWT to localStorage

Backend:

- POST /api/auth/signup - create user
- POST /api/auth/login - return JWT
- POST /api/auth/logout - invalidate token
- Middleware to check JWT on protected routes

Time: 3 hours
Commit: [ADD] implemented user signup and login with JWT

1.4 File Upload Interface
─────────────────────────
What: Create document upload section

Frontend:

- Main dashboard page with upload area
- Drag & drop file upload section
- Browse file button
- Supported formats display: PDF, DOCX, XLSX, TXT
- File size limit: 50MB
- Show list of uploaded files
- Delete button for each file
- Shows upload progress bar

Components:

- UploadZone.tsx (drag & drop area)
- FileList.tsx (shows uploaded files)
- UploadProgress.tsx (progress bar)

Backend endpoints needed for this:

- POST /api/upload - receive and store file
- GET /api/files - list user's files
- DELETE /api/files/{file_id} - delete file

Time: 2 hours
Commit: [ADD] created file upload interface and drag-drop zone

1.5 File Upload & Storage
──────────────────────────
What: Handle file uploads and save to server

Backend:

- POST /api/upload endpoint
- Receive file from frontend
- Validate file type (PDF, DOCX, XLSX, TXT only)
- Validate file size (max 50MB)
- Save to /data/uploads/{user_id}/{filename}
- Store file metadata in DB (filename, size, upload_date)
- Return file_id to frontend

Storage location:

- Local filesystem: /data/uploads/
- OR AWS S3 (for production later)
- For MVP, use local filesystem

Validation:

- Only allow: PDF, DOCX, XLSX, TXT
- Reject others with error message
- Max file size: 50MB
- Virus scan? (skip for MVP)

Time: 2 hours
Commit: [ADD] implemented file upload and storage system

1.6 File Type Detection & Text Extraction
──────────────────────────────────────────
What: Extract text from uploaded files

Backend:

- Detect file type from extension + MIME type
- Extract text based on type:
  - PDF: use PyPDF2
  - DOCX: use python-docx
  - XLSX: use openpyxl
  - TXT: direct read
- Store extracted text in database
- Return success/failure status to frontend

Frontend:

- Show "Processing..." message for each file
- Show "Extraction complete" after text extracted
- Display any errors

Error handling:

- Corrupted PDF → skip, show error
- Encrypted PDF → skip, show error
- Empty file → skip, show error
- Unsupported format → reject

Time: 3 hours
Commit: [ADD] implemented file type detection and text extraction

1.7 Text Chunking & Embedding
─────────────────────────────
What: Split extracted text into chunks and create embeddings

Backend:

- Use LangChain RecursiveCharacterTextSplitter
- Split text into 500-token chunks with 50-token overlap
- For each chunk:
  - Call Mistral Embed API to generate embedding
  - Store chunk text + embedding in PostgreSQL
  - Store metadata (file_id, chunk_index, page_number)
- Show progress to user

After 1.6 completes, automatically chunk and embed

Time: 2 hours
Commit: [ADD] implemented text chunking and Mistral embeddings

1.8 Vector Database Setup (Chroma)
──────────────────────────────────
What: Store embeddings for fast search

Backend:

- Initialize Chroma vector DB
- Self-hosted, in-memory for MVP (data stored in DB on reload)
- After embedding (1.7), insert chunks + vectors into Chroma
- Each embedding gets:
  - Vector (1024 dimensions from Mistral)
  - Metadata: {file_id, chunk_index, page_number, filename}

Time: 1 hour
Commit: [ADD] integrated Chroma vector database

1.9 RAG Query Engine
───────────────────
What: Search uploaded docs and generate answers

Backend:

- POST /api/ask - user asks question
  Input: {question: "What is in these documents?"}

Steps:

1. Convert question to embedding using Mistral Embed
2. Search Chroma for top 5 similar chunks (from uploaded files only)
3. Build prompt with chunks + question
4. Call Mistral LLM API (mistral-large model)
5. Return answer with source chunk IDs

Response:
{
answer: "Based on your documents...",
sources: [
{chunk_id: 1, file_name: "Report.pdf", page: 2},
{chunk_id: 5, file_name: "Data.xlsx", page: 1}
]
}

Time: 3 hours
Commit: [ADD] created RAG query engine with Mistral API

1.10 Citation Mapping
────────────────────
What: Link answers back to source documents

Backend:

- When returning answer, include source chunks
- For each source chunk, include:
  - Original file name
  - Page number (if PDF)
  - Row range (if spreadsheet)
  - Link to view in app

Frontend:

- Display answer
- Below answer, show "Sources from your documents:"
- List clickable citations
- Click → highlight relevant part in document viewer

Time: 1 hour
Commit: [ADD] added citation mapping to source documents

1.11 Document Viewer
───────────────────
What: View uploaded documents in app

Frontend:

- Modal/sidebar to view document
- PDF viewer component (use react-pdf)
- Show text preview for DOCX/XLSX/TXT
- Highlight cited chunks when clicked from answer
- Show page numbers

Time: 2 hours
Commit: [ADD] implemented document viewer component

1.12 Chat History
─────────────────
What: Store questions and answers

Backend:

- POST /api/chat/history - get all past Q&A
- Each message stores:
  - user_id
  - question
  - answer
  - sources
  - timestamp

Frontend:

- Show past conversations
- Click to view previous Q&A
- Show file names used in each conversation

Time: 1 hour
Commit: [ADD] implemented chat history storage

1.13 Frontend Chat UI
────────────────────
What: Build chat interface for local documents

Frontend layout:

Left Sidebar:

- "Upload Documents" section (drag & drop)
- List of uploaded files
- Delete buttons
- File count

Main Area:

- Chat interface (top)
  - Past messages
  - Current Q&A
- Source citations below answers
  - Clickable links
  - Open document viewer

Components:

- ChatInput: text input + send button
- ChatMessage: display Q&A pairs
- SourcesPanel: show citations with document links
- DocumentUpload: drag & drop zone
- FileList: shows uploaded files
- DocumentViewer: view selected document

Time: 3 hours
Commit: [ADD] built chat interface UI components

1.14 Error Handling & Logging
─────────────────────────────
What: Handle failures gracefully

Backend:

- Try-catch around all API calls
- Log errors to console + database
- Return user-friendly error messages
- Retry on temporary failures (retry 3x with backoff)

Common errors:

- Invalid file format → reject with message
- File too large → reject with message
- Upload fails → show retry button
- Text extraction fails → skip file
- Embedding API fails → retry later

Frontend:

- Show error toasts to user
- Retry buttons for failed operations
- Display progress for long operations
- Show file processing status

Time: 2 hours
Commit: [ADD] added comprehensive error handling

════════════════════════════════════════════════════════════════════════════

1.17 Google Drive Integration (End of Phase 1)
───────────────────────────────────────────────
What: Add Google Drive as second upload source

Only after 1.1 to 1.16 are complete, add this

Frontend:

- Add "Connect Google Drive" button in upload section
- Show Google Drive file list (separate from local uploads)
- Allow selecting Drive files to add to knowledge base
- Selected Drive files appear in file list with Drive icon

Backend:

- GET /api/auth/google/callback - OAuth integration
- POST /api/auth/google/connect - connect Drive
- GET /api/drive/files - list user's Drive files
- POST /api/sync/drive/{file_id} - download and process Drive file
- Store Drive files same way as local uploads (in files table)

Endpoints:

- Similar to local upload
- But download from Google Drive instead

Frontend shows both:

- Local uploaded files
- Google Drive connected files
- All searchable together in same RAG query

Time: 3 hours
Commit: [ADD] integrated Google Drive file selection and sync

════════════════════════════════════════════════════════════════════════════

PHASE 1 WORKFLOW (Step by Step):

User Journey:

1. Sign up with email/password
2. Land on dashboard
3. See upload area (drag & drop zone)
4. Upload 3 PDF files (Reports, Data, Notes)
5. Files appear in file list
6. App automatically:
   - Extracts text from each PDF
   - Splits into 500-token chunks
   - Generates embeddings for each chunk
   - Stores in Chroma
   - Shows "Processing complete"
7. User opens chat section
8. Types question: "What was Q3 revenue?"
9. App searches all uploaded files
10. Finds relevant chunks from "Reports.pdf"
11. Generates answer using Mistral
12. Shows answer + clickable citation to Reports.pdf
13. User clicks citation
14. Document viewer opens showing relevant page
15. User asks another question
16. Chat history saved
17. All past Q&A available

After Phase 1 is working perfectly: 18. User clicks "Connect Google Drive" 19. Approves OAuth 20. Selects files from Drive to add to knowledge base 21. Selected files download and process same as local uploads 22. Questions now search both local + Drive files

════════════════════════════════════════════════════════════════════════════

TECH STACK:

Frontend:

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer for animations
- react-pdf (PDF viewer)
- shadcn/ui components

Backend:

- Python 3.11+
- FastAPI
- SQLAlchemy ORM
- PostgreSQL

Vector & Storage:

- Chroma (vector DB, self-hosted)
- Local filesystem (/data/uploads/)
- supabase (chunk storage)

LLM & Embeddings:

- Mistral API (LLM)
- Any free embedding model

File Processing:

- PyPDF2 (PDF)
- python-docx (DOCX)
- openpyxl (XLSX)

Security:

- JWT for auth
- Password hashing (bcrypt)
- File upload validation

════════════════════════════════════════════════════════════════════════════

API ENDPOINTS (Phase 1):

Auth:

- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout

Upload (Local):

- POST /api/upload - upload file
- GET /api/files - list user's files
- DELETE /api/files/{file_id} - delete file
- GET /api/files/{file_id}/content - view file content

RAG:

- POST /api/ask - ask question about docs
- GET /api/chat/history - get past Q&A

Google Drive (added 1.17):

- POST /api/auth/google/callback - OAuth callback
- POST /api/auth/google/connect - connect Drive
- GET /api/drive/files - list Drive files
- POST /api/sync/drive/{file_id} - sync Drive file

COMMIT STYLE:

[ADD] initialized Next.js frontend and FastAPI backend
[ADD] created database schema for users, files, chunks
[ADD] implemented user signup and login with JWT
[ADD] created file upload interface and drag-drop zone
[ADD] implemented file upload and storage system
[ADD] implemented file type detection and text extraction
[ADD] implemented text chunking and Mistral embeddings
[ADD] integrated Chroma vector database
[ADD] created RAG query engine with Mistral API
[ADD] added citation mapping to source documents
[ADD] implemented document viewer component
[ADD] implemented chat history storage
[ADD] built chat interface UI components
[ADD] added comprehensive error handling
[ADD] tested MVP end-to-end with local uploads
[ADD] deployed MVP to Vercel and Railway (local upload version)
[ADD] integrated Google Drive file selection and sync

multiple commits per subtask
Push after each subtask completion
