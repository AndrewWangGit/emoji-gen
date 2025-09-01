# 🎨 Emoji Generator

A React/Express application that uses Google's Gemini 2.5 Flash (nano banana) to create custom Slack emojis from uploaded images.

## Features

- 📁 **Image Upload**: Upload any image to use as a base for your emoji
- 📝 **Custom Descriptions**: Add descriptions to guide the AI generation
- 🎭 **Background Removal**: Option to remove backgrounds automatically
- 😊 **Emojify**: Transform images into cute, cartoon-style emojis
- 💾 **Download**: Download your generated emojis
- ⏳ **Real-time Progress**: Loading states and progress indicators

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd emoji-gen
   npm run install:all
   ```

2. **Set up environment variables**:
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your Gemini API key:
   ```
   GEMINI_API_KEY=your-actual-api-key-here
   PORT=5000
   ```

3. **Get a Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create an account or sign in
   - Generate an API key for Gemini
   - Copy the key to your `.env` file

### Running the Application

1. **Start both servers**:
   ```bash
   npm run dev
   ```

   This will start:
   - React frontend on `http://localhost:3000`
   - Express backend on `http://localhost:5000`

2. **Or run them separately**:
   ```bash
   # Terminal 1 - Backend
   npm run server

   # Terminal 2 - Frontend  
   npm run client
   ```

### Usage

1. Open `http://localhost:3000` in your browser
2. Upload an image you want to turn into an emoji
3. Optionally add a description of what you want your emoji to represent
4. Check "Remove Background" to automatically remove the background
5. Check "Emojify" to make it look more like a typical cartoon emoji
6. Click "✨ Turn into Emoji" and wait for the AI to generate your emoji
7. Download the result when it's ready

## Project Structure

```
emoji-gen/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   └── App.css        # Styling
│   └── package.json
├── server/                 # Express backend
│   ├── server.js          # Main server file
│   ├── gemini.js          # Gemini API integration
│   ├── uploads/           # Uploaded and generated images
│   └── package.json
├── package.json           # Root package.json for scripts
└── README.md
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/generate-emoji` - Generate emoji from uploaded image

## Technologies Used

- **Frontend**: React, TypeScript, CSS3
- **Backend**: Node.js, Express.js
- **AI**: Google Gemini 2.5 Flash Image (nano banana)
- **File Upload**: Multer
- **Image Processing**: Google Generative AI

## Limitations

- Images must be under 10MB
- Supported formats: JPG, PNG, GIF, WebP
- Generated images include SynthID watermarks (from Gemini)
- Best results with clear, simple images

## Troubleshooting

- **"Gemini service not available"**: Check your API key in the `.env` file
- **Upload fails**: Ensure image is under 10MB and in a supported format
- **Generation takes long**: Gemini API calls can take 10-30 seconds
- **Port conflicts**: Change the PORT in your `.env` file if 5000 is taken

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request