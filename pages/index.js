import { useState } from 'react';

const CopyButton = ({ content, label = "Copy" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 text-sm"
    >
      {copied ? "Copied!" : label}
    </button>
  );
};

const ImageActions = ({ imageData, index, type, pageNumber }) => {
  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageData}`;
    link.download = `${type === 'page' ? 'page' : 'image'}-${pageNumber || index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={downloadImage}
        className="bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600 text-sm"
      >
        Download
      </button>
      <CopyButton 
        content={imageData} 
        label="Copy Base64"
      />
    </div>
  );
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [format, setFormat] = useState('text');
  const [includeMetadata, setIncludeMetadata] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setProcessing(true);
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('format', format);
    formData.append('includeMetadata', includeMetadata);
    formData.append('includeImages', includeImages);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error processing PDF:', error);
    } finally {
      setProcessing(false);
    }
  };

  const renderImages = (images) => {
    if (!images || images.length === 0) return null;
    
    return (
      <div className="mt-4 border-t pt-4">
        <h3 className="text-lg font-semibold mb-4">Extracted Images</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {images.map((img, i) => (
            <div key={i} className="border rounded-lg p-4 bg-white shadow">
              <div className="text-sm text-gray-600 mb-2">
                {img.type === 'page' ? `Page ${img.pageNumber}` : `Image from Page ${img.pageNumber}`}
              </div>
              <img
                src={`data:image/png;base64,${img.data}`}
                alt={`${img.type === 'page' ? 'Page' : 'Image'} ${img.pageNumber}`}
                className="max-w-full rounded shadow-sm"
              />
              <ImageActions 
                imageData={img.data}
                index={i}
                type={img.type}
                pageNumber={img.pageNumber}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">PDF Processor</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload PDF
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-sm border rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Output Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            >
              <option value="text">Plain Text</option>
              <option value="markdown">Markdown</option>
              <option value="ocr">OCR Text</option>
              <option value="images">Images Only</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeMetadata"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <label htmlFor="includeMetadata" className="ml-2 block text-sm text-gray-900">
                Include Metadata (JSON output)
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeImages"
                checked={includeImages || format === 'images'}
                disabled={format === 'images'}
                onChange={(e) => setIncludeImages(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <label htmlFor="includeImages" className="ml-2 block text-sm text-gray-900">
                Include Images
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={!file || processing}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Process PDF'}
          </button>
        </form>

        {result && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Results</h2>
            {format === 'images' ? (
              renderImages(result.images)
            ) : (
              <div>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">
                      {includeMetadata ? 'JSON Output' : 'Text Output'}
                    </span>
                    <CopyButton 
                      content={includeMetadata ? JSON.stringify(result, null, 2) : (result.text || result)} 
                    />
                  </div>
                  <pre className="overflow-auto max-h-96 whitespace-pre-wrap">
                    {includeMetadata ? JSON.stringify(result, null, 2) : (result.text || result)}
                  </pre>
                </div>
                {includeImages && result.images && renderImages(result.images)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
