# PDF Processing API

A powerful Next.js API for extracting text and images from PDF files, with OCR capabilities using Tesseract.js and pdf.js.

## Features

- Text extraction with proper formatting
- Image extraction (embedded images and full pages)
- OCR processing using Tesseract.js
- Multiple output formats (text, markdown, JSON)
- Metadata support
- High-quality image processing

## API Usage

### Endpoint

```
POST /api/process
```

### Request Format

Send a `multipart/form-data` request with the following fields:

- `pdf`: PDF file (required, max 10MB)
- `format`: Output format (optional, default: 'text')
  - `text`: Plain text extraction
  - `markdown`: Markdown formatted text
  - `ocr`: OCR text from images
  - `images`: Extract images only
- `includeMetadata`: Include file and processing metadata (optional, default: false)
- `includeImages`: Include extracted images with any format (optional, default: false)

### Examples

#### 1. Basic Text Extraction

```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('format', 'text');

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
// result: { text: "Extracted text content..." }
```

#### 2. Markdown with Metadata

```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('format', 'markdown');
formData.append('includeMetadata', 'true');

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
/* result: {
  text: "# Document Title\n\nExtracted text...",
  metadata: {
    fileSize: 1234567,
    filename: "document.pdf",
    timestamp: "2025-03-11T23:42:32-04:00",
    processedWith: "markdown",
    extractionMethod: "pdf.js-enhanced"
  }
} */
```

#### 3. Text with Images

```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('format', 'text');
formData.append('includeImages', 'true');

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
/* result: {
  text: "Extracted text content...",
  images: [
    {
      data: "base64_encoded_image_data",
      type: "page",
      pageNumber: 1,
      width: 1654,
      height: 2340
    },
    {
      data: "base64_encoded_image_data",
      type: "image",
      pageNumber: 1,
      width: 800,
      height: 600
    }
  ]
} */
```

#### 4. OCR Processing with Metadata

```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('format', 'ocr');
formData.append('includeMetadata', 'true');

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
/* result: {
  text: "OCR extracted text...",
  metadata: {
    fileSize: 1234567,
    filename: "document.pdf",
    timestamp: "2025-03-11T23:42:32-04:00",
    processedWith: "pdf.js-enhanced+tesseract.js",
    extractionMethod: "pdf.js-enhanced"
  }
} */
```

#### 5. Images Only

```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('format', 'images');

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
/* result: {
  images: [
    {
      data: "base64_encoded_image_data",
      type: "page",
      pageNumber: 1,
      width: 1654,
      height: 2340
    },
    {
      data: "base64_encoded_image_data",
      type: "image",
      pageNumber: 1,
      width: 800,
      height: 600
    }
  ]
} */
```

#### 6. Complete Example with All Options

```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('format', 'markdown');
formData.append('includeMetadata', 'true');
formData.append('includeImages', 'true');

const response = await fetch('/api/process', {
  method: 'POST',
  body: formData
});

const result = await response.json();
/* result: {
  text: "# Document Title\n\nExtracted text...",
  images: [
    {
      data: "base64_encoded_image_data",
      type: "page",
      pageNumber: 1,
      width: 1654,
      height: 2340
    }
  ],
  metadata: {
    fileSize: 1234567,
    filename: "document.pdf",
    timestamp: "2025-03-11T23:42:32-04:00",
    processedWith: "markdown",
    extractionMethod: "pdf.js-enhanced"
  }
} */
```

### Fetch API Examples

You can also call the API directly using fetch. Here are some examples:

#### 1. Basic Text Extraction (Node.js)

```javascript
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

async function extractText() {
  const form = new FormData();
  form.append('pdf', fs.createReadStream('document.pdf'));
  form.append('format', 'text');

  const response = await fetch('http://localhost:3000/api/process', {
    method: 'POST',
    body: form
  });

  const result = await response.json();
  console.log(result.text);
}
```

#### 2. Extract Images with Metadata (Python)

```python
import requests

with open('document.pdf', 'rb') as f:
    files = {'pdf': ('document.pdf', f, 'application/pdf')}
    data = {
        'format': 'images',
        'includeMetadata': 'true'
    }
    response = requests.post(
        'http://localhost:3000/api/process',
        files=files,
        data=data
    )
    result = response.json()
    print(result['metadata'])
    # Save first image
    if result['images']:
        import base64
        img_data = base64.b64decode(result['images'][0]['data'])
        with open('output.png', 'wb') as img_file:
            img_file.write(img_data)
```

### Error Handling

The API returns appropriate HTTP status codes and error messages:

```javascript
// 400 Bad Request - Invalid input
{
  "error": "No PDF file uploaded"
}

// 400 Bad Request - Invalid format
{
  "error": "Invalid format specified"
}

// 405 Method Not Allowed
{
  "error": "Method not allowed"
}

// 500 Internal Server Error
{
  "error": "Error processing PDF: detailed error message"
}
```

## Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) to view the application.

## Dependencies

- `next`: ^14.0.0
- `react`: ^18.2.0
- `react-dom`: ^18.2.0
- `pdfjs-dist`: 3.11.174
- `tesseract.js`: ^5.0.3
- `multer`: ^1.4.5-lts.1
- `canvas`: ^2.11.2
- `@tailwindcss/forms`: ^0.5.7
- `tailwindcss`: ^3.3.5
- `postcss`: ^8.4.31
- `postcss-import`: ^15.1.0
