import { GoogleGenerativeAI } from '@google/generative-ai';
import { FileState, GoogleAIFileManager } from '@google/generative-ai/server';
import * as fs from 'fs';
import * as path from 'path';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in the environment variables.');
    }

    const modelName = process.env.GEMINI_MODEL ?? 'gemini-3-pro-preview';
    this.modelName = modelName;
    console.log(`Using Gemini model: ${this.modelName}`);

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.fileManager = new GoogleAIFileManager(apiKey);
  }

  async uploadFile(filePath: string, mimeType: string): Promise<string> {
    try {
      // Resolve the file path
      const resolvedPath = path.resolve(filePath);
      
      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File not found: ${resolvedPath}`);
      }

      // Read the file
      const fileBuffer = fs.readFileSync(resolvedPath);

      // Upload the file (Buffer is required here, not the path)
      const uploadResult = await this.fileManager.uploadFile(fileBuffer, {
        mimeType,
        displayName: path.basename(resolvedPath),
      });

      // Get the file object
      let file = await this.fileManager.getFile(uploadResult.file.name);

      // Poll until file state is ACTIVE
      while (file.state !== FileState.ACTIVE) {
        if (file.state === FileState.FAILED) {
          const details = file.error ? ` (${file.error.code}: ${file.error.message})` : '';
          throw new Error(`File processing failed for ${file.name}${details}`);
        }

        // Wait 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Refresh file state
        file = await this.fileManager.getFile(uploadResult.file.name);
      }

      // Return the file URI
      return file.uri;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async generateResponse(prompt: string, fileUri: string, mimeType: string): Promise<string> {
    try {
      // Get the model
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      // Create the content parts
      const parts = [
        { text: prompt },
        {
          fileData: {
            mimeType: mimeType,
            fileUri: fileUri,
          },
        },
      ];

      // Generate content
      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async generateFromParts(parts: any[], options?: { temperature?: number }): Promise<string> {
    try {
      // Get the model
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: options?.temperature !== undefined ? { temperature: options.temperature } : undefined,
      });

      // Generate content
      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      const response = await result.response;
      
      return response.text();
    } catch (error) {
      console.error('Error generating from parts:', error);
      throw error;
    }
  }
}

