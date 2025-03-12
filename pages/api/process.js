import multer from 'multer';
import { createWorker } from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { promises as fs } from 'fs';
import path from 'path';
import { createCanvas, Image } from 'canvas';

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Configure pdf.js worker
if (typeof window === 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js');
}

// Middleware to handle file upload
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

async function extractText(pdfData) {
  try {
    const uint8Array = new Uint8Array(pdfData);
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map(item => item.str)
        .reduce((text, word) => {
          // Add space after punctuation marks
          if (/[.!?]$/.test(text)) {
            return `${text} ${word}`;
          }
          // Add space between words if they're not already separated
          return /\s$/.test(text) ? `${text}${word}` : `${text} ${word}`;
        }, '');
      fullText += pageText + '\n\n'; // Add double newline between pages
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

async function addAlphaChannelToUnit8ClampedArray(unit8Array, imageWidth, imageHeight) {
  const newImageData = new Uint8ClampedArray(imageWidth * imageHeight * 4);
  
  for (let j = 0, k = 0, jj = imageWidth * imageHeight * 4; j < jj;) { 
    newImageData[j++] = unit8Array[k++];
    newImageData[j++] = unit8Array[k++];
    newImageData[j++] = unit8Array[k++];
    newImageData[j++] = 255;
  }

  return newImageData;
}

async function extractImages(pdfData) {
  try {
    const uint8Array = new Uint8Array(pdfData);
    const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
    const images = [];

    const validObjectTypes = [
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintImageXObjectRepeat,
      pdfjs.OPS.paintJpegXObject
    ];

    for (let i = 1; i <= pdf.numPages; i++) {
      // First extract embedded images from the page
      const page = await pdf.getPage(i);
      const operatorList = await page.getOperatorList();

      // Process each image operation
      for (let j = 0; j < operatorList.fnArray.length; j++) {
        const operator = operatorList.fnArray[j];
        if (validObjectTypes.includes(operator)) {
          const imageName = operatorList.argsArray[j][0];
          
          try {
            const image = await new Promise((resolve) => {
              page.objs.get(imageName, (img) => resolve(img));
            });

            if (image && image.data && image.width && image.height && image.width > 50 && image.height > 50) {
              const imageDataWithAlpha = await addAlphaChannelToUnit8ClampedArray(
                image.data,
                image.width,
                image.height
              );

              const canvas = createCanvas(image.width, image.height);
              const ctx = canvas.getContext('2d');
              
              // Set white background
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, image.width, image.height);

              // Create and put image data
              const imageData = ctx.createImageData(image.width, image.height);
              imageData.data.set(imageDataWithAlpha);
              ctx.putImageData(imageData, 0, 0);

              const pngData = canvas.toBuffer('image/png');
              images.push({
                data: pngData.toString('base64'),
                type: 'image',
                pageNumber: i,
                width: image.width,
                height: image.height
              });
            }
          } catch (imgError) {
            console.error('Error processing image:', imgError);
          }
        }
      }

      // Then capture the full page
      try {
        const viewport = page.getViewport({ scale: 2.0 }); // Higher quality page rendering
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        await page.render({
          canvasContext: context,
          viewport: viewport,
          background: 'white'
        }).promise;

        const pngData = canvas.toBuffer('image/png');
        images.push({
          data: pngData.toString('base64'),
          type: 'page',
          pageNumber: i,
          width: viewport.width,
          height: viewport.height
        });
      } catch (pageError) {
        console.error('Error capturing page:', pageError);
      }
    }

    // Sort images by page number and type (pages first, then embedded images)
    images.sort((a, b) => {
      if (a.pageNumber !== b.pageNumber) {
        return a.pageNumber - b.pageNumber;
      }
      return a.type === 'page' ? -1 : 1;
    });

    return { images };
  } catch (error) {
    console.error('Error in image extraction:', error);
    return { images: [] };
  }
}

async function performOCR(imageBase64) {
  const worker = await createWorker();
  try {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    const { data: { text } } = await worker.recognize(dataUrl);
    return text;
  } finally {
    await worker.terminate();
  }
}

function createMetadata(fileInfo, processedWith) {
  return {
    metadata: {
      fileSize: fileInfo.size,
      filename: fileInfo.originalname,
      timestamp: new Date().toISOString(),
      processedWith,
      extractionMethod: 'pdf.js-enhanced'
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await runMiddleware(req, res, upload.single('pdf'));

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const format = req.body.format || 'text';
    const includeMetadata = req.body.includeMetadata === 'true';
    const includeImages = req.body.includeImages === 'true';
    const pdfBuffer = req.file.buffer;

    let result;
    let processedWith = format;

    // Extract images if format is 'images' or includeImages is true
    let extractedImages;
    if (format === 'images' || includeImages) {
      extractedImages = await extractImages(pdfBuffer);
    }

    switch (format) {
      case 'text': {
        const text = await extractText(pdfBuffer);
        result = { text };
        break;
      }
      case 'markdown': {
        const text = await extractText(pdfBuffer);
        result = { text: `# ${req.file.originalname}\n\n${text}` };
        break;
      }
      case 'images': {
        result = extractedImages;
        processedWith = 'pdf.js-enhanced';
        break;
      }
      case 'ocr': {
        const images = extractedImages || await extractImages(pdfBuffer);
        const ocrResults = [];
        for (const imageBase64 of images.images.map(image => image.data)) {
          const ocrText = await performOCR(imageBase64);
          if (ocrText.trim()) {
            ocrResults.push(ocrText);
          }
        }
        result = { text: ocrResults.join('\n\n') };
        processedWith = 'pdf.js-enhanced+tesseract.js';
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid format specified' });
    }

    // Add images to result if requested
    if (includeImages && format !== 'images') {
      result.images = extractedImages.images;
    }

    // Add metadata if requested
    if (includeMetadata) {
      result = {
        ...result,
        ...createMetadata(req.file, processedWith)
      };
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Error processing PDF: ' + error.message });
  }
}
