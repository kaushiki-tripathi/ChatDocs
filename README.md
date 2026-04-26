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

## Live Demo & Screenshots
- Coming soon...

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
| ChromaDB | Vector database |
| Groq API | LLM for answer generation |
| Embeddings | Semantic search |

### DevOps
| Technology | Purpose |
|------------|---------|
| Git & GitHub | Version control |
| Vercel | Frontend deployment |
| Railway | Backend deployment |
| MongoDB Atlas | Cloud database |

---

## Features

### Currently Built ✅
- [x] Google OAuth Authentication (Sign in with Google)
- [x] PDF Document Upload (up to 10MB)
- [x] PDF Text Extraction
- [x] Document Management (upload, view, delete)
- [x] User-specific document library
- [x] RESTful API Architecture

### In Progress 🔄
- [ ] React Frontend (Landing page, Dashboard, Chat UI)
- [ ] RAG Pipeline (Retrieval Augmented Generation)
- [ ] Text Chunking and Processing
- [ ] Embeddings Generation
- [ ] ChromaDB Vector Database Integration
- [ ] Groq AI Answer Generation
- [ ] Chat with Page References

### Future Goals 🎯
- [ ] Multiple document chat (search across all PDFs)
- [ ] Chat history and conversation management
- [ ] Document summary with one click
- [ ] Export chat as PDF report
- [ ] Dark mode
- [ ] Mobile responsive design
- [ ] Support for Word documents (.docx)
- [ ] Support for PowerPoint (.pptx)
- [ ] Collaborative document sharing
- [ ] Usage analytics dashboard
---

##  Architecture: 
ChatDocs uses RAG (Retrieval Augmented Generation):

- UPLOAD PHASE:
PDF → Extract Text → Split into Chunks → Convert to Embeddings → Store in ChromaDB

- QUESTION PHASE:
User Question → Convert to Embedding → Search ChromaDB → Get Top 5 Relevant Chunks → Build Prompt → Send to Groq AI → Get Answer with Page References → Show to User

---

### Prerequisites
```
Node.js v18+
MongoDB Atlas account
Google Cloud Console account
Groq API account (free)
```

```
Environment Variables

PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLIENT_URL=http://localhost:300
```
```
# Clone the repository
git clone https://github.com/yourusername/chatdocs-backend.git

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