const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

class GeminiService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-image-preview' 
    });
  }

  async generateEmoji(imagePath = null, description, removeBackground = false, emojify = false, userEmail = null) {
    try {
      console.log('Generating emoji with Gemini 2.5 Flash...');
      
      // Build the prompt based on user options
      const prompt = this.buildPrompt(description, removeBackground, emojify, !imagePath);
      
      console.log('Using prompt:', prompt);

      let contentParts = [prompt];
      
      // Only add image if path is provided
      if (imagePath) {
        const imageBytes = fs.readFileSync(imagePath);
        const imageBase64 = imageBytes.toString('base64');
        
        const imagePart = {
          inlineData: {
            data: imageBase64,
            mimeType: this.getMimeType(imagePath)
          }
        };
        contentParts.push(imagePart);
      }

      // Generate content
      const result = await this.model.generateContent(contentParts);
      const response = await result.response;
      
      // Debug the response structure
      console.log('Full response structure:', JSON.stringify(response, null, 2));
      console.log('Response candidates:', response.candidates);
      console.log('First candidate:', response.candidates?.[0]);
      console.log('Content parts:', response.candidates?.[0]?.content?.parts);

      // Check each part
      let generatedImageData = null;
      let responseText = '';
      
      if (response.candidates?.[0]?.content?.parts) {
        response.candidates[0].content.parts.forEach((part, index) => {
          console.log(`Part ${index}:`, Object.keys(part));
          if (part.text) {
            responseText += part.text;
          } else if (part.inlineData) {
            console.log(`Part ${index} has inline data with mimeType:`, part.inlineData.mimeType);
            generatedImageData = part.inlineData.data;
          }
        });
      }
      
      console.log('Gemini response text:', responseText);
      
      if (generatedImageData) {
        // Create user directory and save the generated image
        const userDir = this.createUserDirectory(userEmail);
        const timestamp = Date.now();
        const filename = `emoji-${timestamp}.png`;
        const outputPath = path.join(userDir, filename);
        const imageBuffer = Buffer.from(generatedImageData, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        
        // Save metadata
        const metadata = {
          filename,
          description: description || 'Generated emoji',
          prompt: prompt,
          timestamp,
          removeBackground,
          emojify,
          originalImage: imagePath ? path.basename(imagePath) : null
        };
        
        const metadataPath = path.join(userDir, `emoji-${timestamp}.json`);
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        return {
          success: true,
          outputPath: outputPath,
          filename: filename,
          prompt: prompt,
          userPath: path.join(this.getSafeEmail(userEmail), filename)
        };
      } else {
        throw new Error('No image data found in response. Response was text only.');
      }
    } catch (error) {
      console.error('Error generating emoji with Gemini:', error);
      throw error;
    }
  }

  buildPrompt(description, removeBackground, emojify, textToImageOnly = false) {
    let prompt = '';
    
    if (textToImageOnly) {
      prompt = 'Generate an emoji image that represents: ';
    } else {
      prompt = 'Using the provided image, ';
    }

    if (description) {
      prompt += textToImageOnly ? `${description}. ` : `create an image that represents: ${description}. `;
    } else {
      prompt += textToImageOnly ? 'a generic image. ' : 'transform this image into a square format. ';
    }

    if (emojify) {
      prompt += 'Make it look like a typical emoji with cute, cartoon-style features, bold simple lines, bright vibrant colors, and a friendly expressive appearance. ';
    }

    if (removeBackground) {
      prompt += 'Remove the background completely and make it transparent, focusing only on the main subject. ';
    }

    // Core requirements
    prompt += 'IMPORTANT: The output image MUST be: ' +
              '- Exactly square dimensions (1:1 aspect ratio - same width and height) ' +
              '- Do not preserve the original aspect ratio ' +
              '- Force the image into a perfect square format ' +
              '- Clear and recognizable at small sizes ' +
              '- Simple, clean design with minimal details ' +
              '- High contrast colors ' +
              '- Professional quality';

    return prompt;
  }

  createUserDirectory(email) {
    if (!email) return path.join(__dirname, 'uploads');
    
    const safeEmail = this.getSafeEmail(email);
    const userDir = path.join(__dirname, 'uploads', safeEmail);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    return userDir;
  }
  
  getSafeEmail(email) {
    return email.replace(/[^a-zA-Z0-9@.-]/g, '_');
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}

module.exports = GeminiService;