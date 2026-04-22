import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

// Path to the data file (relative to the project root)
// Note: __dirname doesn't work the same way in API routes, use process.cwd()
const dataFilePath = path.join(process.cwd(), 'call-log-data.json');
// Path to the public images directory
const publicImagesDir = path.join(process.cwd(), 'public', 'images');

// Ensure the public/images directory exists
if (!fs.existsSync(publicImagesDir)) {
  fs.mkdirSync(publicImagesDir, { recursive: true });
}

// Disable Next.js body parsing for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to read data from the JSON file
const readData = () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const jsonData = fs.readFileSync(dataFilePath, 'utf-8');
      return JSON.parse(jsonData);
    } else {
      return [];
    }
  } catch (error) {
    console.error("API Error reading call log data:", error);
    return [];
  }
};

// Helper function to write data to the JSON file
const writeData = (data) => {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(dataFilePath, jsonData, 'utf-8');
  } catch (error) {
    console.error("API Error writing call log data:", error);
  }
};

export default async function handler(req, res) {
  let logs = readData();

  if (req.method === 'GET') {
    // GET: Return all logs sorted by timestamp descending
    const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.status(200).json(sortedLogs);

  } else if (req.method === 'POST') {
    const form = formidable({});

    try {
      // Parse the incoming form data (including file uploads)
      const [fields, files] = await form.parse(req);
      
      let priceListImagePath = null;
      const imageFile = files.priceListImage?.[0];

      if (imageFile) {
        // Generate a unique filename or use the original (be cautious of overwrites/collisions)
        const uniqueFilename = `${Date.now()}-${imageFile.originalFilename}`;
        const newPath = path.join(publicImagesDir, uniqueFilename);
        
        // Move the uploaded file from temp location to public/images
        fs.renameSync(imageFile.filepath, newPath);
        priceListImagePath = `/images/${uniqueFilename}`;
      }

      // Extract text fields (formidable puts them in arrays too)
      const getFieldValue = (fieldName) => fields[fieldName]?.[0] || '';

      // Handle products array (might come as a stringified array or comma-separated)
      const getProductsArray = (fieldValue) => {
          if (!fieldValue) return [];
          try {
              // If client sends a proper JSON array string
              const parsed = JSON.parse(fieldValue);
              return Array.isArray(parsed) ? parsed : [fieldValue]; 
          } catch (e) {
              // If client sends comma-separated string
              return fieldValue.split(',').map(p => p.trim()).filter(p => p !== '');
          }
      };

      const nextId = logs.length > 0 ? Math.max(...logs.map(log => log.id)) + 1 : 1;
      const newLog = {
        id: nextId,
        timestamp: new Date().toISOString(),
        farmName: getFieldValue('farmName'),
        contact: getFieldValue('contact'),
        address: getFieldValue('address'),
        searchKeyword: getFieldValue('searchKeyword'),
        source: getFieldValue('source'),
        memo: getFieldValue('memo'),
        products: getProductsArray(fields.products?.[0]),
        priceListImage: priceListImagePath,
      };

      logs.push(newLog);
      writeData(logs);
      res.status(201).json(newLog);

    } catch (error) {
      console.error("API POST Error (formidable/fs):", error);
      res.status(500).json({ message: 'Error processing form data.' });
    }

  } else if (req.method === 'DELETE') {
    // DELETE: Remove a log by ID
    const { id } = req.query; // Get ID from query parameter (e.g., /api/call-logs?id=5)
    const logId = parseInt(id, 10);
    const initialLength = logs.length;
    logs = logs.filter(log => log.id !== logId);
    if (logs.length < initialLength) {
      writeData(logs);
      res.status(200).json({ message: `Log with id ${logId} deleted.` });
    } else {
      res.status(404).json({ message: `Log with id ${logId} not found.` });
    }

  } else {
    // Handle other methods or return error
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 