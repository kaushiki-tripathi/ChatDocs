<div align="center">

# ChatDocs 

It is an AI-powered web application that lets users upload PDF documents and have intelligent conversations with them. 
Ask questions in plain English, get instant accurate answers with exact page references.

---
</div>

##  The Problem: 
- Humans waste millions of hours every day searching through documents for information that takes seconds to find the text.
- Finding specific information inside large documents is slow, painful, and extremely inefficient.


We all deal with large documents every day.
- Student | 500 page textbook | Exam tomorrow. Cannot find specific topic. Reads for hours. 
- Employee | 800 page company handbook | Simple policy question. HR is busy. Waits 2 days for reply. 
- Researcher | 50 research papers | Needs specific methodology. Reads every paper manually. Takes weeks. 
- Lawyer | 2000 page legal contract | Client needs specific clause urgently. CTRL+F misses context. 
- Doctor | Medical literature | Needs specific drug interaction info. Cannot search by meaning.

---

## The Solution: 
- Upload any PDF document.
- Ask any questions.
- Get the exact answer in seconds.
- With the exact page number it came from.

---

## Screenshots
- **Login Page**
![image](https://github.com/kaushiki-tripathi/ChatDocs/blob/6effb04605aea99e911d85bffce2c6f8c3961f54/Login%20Page.png)
- **Sidebar Page**
![image](https://github.com/kaushiki-tripathi/ChatDocs/blob/6effb04605aea99e911d85bffce2c6f8c3961f54/Sidebar.png)
- **Chat Page**
![image](https://github.com/kaushiki-tripathi/ChatDocs/blob/6effb04605aea99e911d85bffce2c6f8c3961f54/ChatPage.png)
- **History Page**
![image](https://github.com/kaushiki-tripathi/ChatDocs/blob/6effb04605aea99e911d85bffce2c6f8c3961f54/History%20Page.png)

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React.js | User interface |
| Tailwind CSS | Styling |
| Axios | API calls |
| React Router | Navigation |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB | Main database |
| Mongoose | MongoDB  |
| Passport.js | Google OAuth |
| JWT | Authentication tokens |
| Multer | File upload handling |
| pdf-parse | PDF text extraction |

### AI & Search
| Technology | Purpose |
|------------|---------|
| Google Gemini API | Text embeddings (text-embedding-004) |
| Groq API | LLM answer generation (llama3-8b-8192) |
| ChromaDB | Vector database (semantic search) |
| Docker | Running ChromaDB server |

### DevOps
| Technology | Purpose |
|------------|---------|
| Git + GitHub | Version control |
| Docker | ChromaDB containerization |
| Vercel | Frontend deployment (planned) |
| Railway | Backend deployment (planned) |
| MongoDB Atlas | Cloud database |

---

## Features

### Currently Built ✅
- [x] Google OAuth Authentication (Sign in with Google)
- [x] PDF Document Upload (up to 10MB)
- [x] PDF Text Extraction
- [x] RAG Pipeline (Retrieval Augmented Generation)
- [x] Google Gemini Embeddings (text-embedding-004)
- [x] ChromaDB Vector Database (semantic search)
- [x] Groq AI Answer Generation (llama3-8b-8192)
- [x] Top-K Retrieval (K=4 most relevant chunks)
- [x] Query Cleaning and Validation
- [x] Context Window Management
- [x] Real-time Streaming Responses (word by word)
- [x] Page References (every answer cites exact page)
- [x] Chat History (persists after logout)
- [x] Multiple Document Management
- [x] Duplicate Document Prevention
- [x] Conversation Delete
- [x] Document Delete (clears vectors too)
- [x] Toast Notifications
- [x] Chat History Awareness (last 6 messages)
- [x] Error Handling (empty PDF, no chunks, irrelevant questions)

---

##  Architecture: 

### RAG Pipeline
UPLOAD PHASE (once per document):
PDF Upload
→ Extract Text (pdf-parse)
→ Split into Chunks (1000 chars, 200 overlap)
→ Generate Embeddings (Google Gemini)
→ Store in ChromaDB with metadata (page numbers)

### QUESTION PHASE (every question):

User Question
→ Clean Query
→ Generate Question Embedding (Gemini)
→ Search ChromaDB → Top 4 Similar Chunks
→ Format Context with Page Numbers
→ Add Chat History
→ Stream to Groq AI (llama3-8b-8192)
→ Stream Response to Frontend (SSE)
→ Save to MongoDB
---

### Prerequisites
```
Node.js v18+
Docker Desktop (for ChromaDB)
MongoDB Atlas account
Google Cloud Console account
Groq API account (free)
Google AI Studio account (free, for Gemini)
```

```
Environment Variables

PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLIENT_URL=http://localhost:5173
GROQ_API_KEY
GEMINI_API_KEY
```
```
# Clone the repository
git clone https://github.com/yourusername/chatdocs-backend.git

# Pull and run ChromaDB container
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma

# Verify it is running
docker ps

# Test ChromaDB heartbeat
curl http://localhost:8000/api/v1/heartbeat

# Stop ChromaDB
docker stop chromadb

# Start ChromaDB again
docker start chromadb

# View logs
docker logs chromadb

# Go to backend folder
cd backend

# Install dependencies
npm install

# Create .env file

# Add your credentials to .env file

# Start development server
npm run dev
```
## Author
- Kaushiki Tripathi
- LinkedIn: https://www.linkedin.com/in/kaushikitripathi2005/
