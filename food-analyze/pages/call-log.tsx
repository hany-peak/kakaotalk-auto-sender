import React, { useState, useEffect, useMemo } from 'react';
import styles from './CallLog.module.css'; // Import CSS module
import Modal from '../components/Modal'; // Import Modal
import AddLogForm from '../components/AddLogForm';

// Define the type for log data
interface LogData {
  id: number;
  farmName: string;
  contact: string;
  address?: string; // Add address (optional)
  searchKeyword: string;
  source: string;
  memo: string;
  products?: string[]; // Add products (optional array of strings)
  priceListImage: string | null;
  timestamp: string;
}

// Type for new log data (optional fields)
interface NewLogData {
  farmName?: string;
  contact?: string;
  address?: string; // Add address
  searchKeyword?: string;
  source?: string;
  memo?: string;
  products?: string; // Add products (as comma-separated string for form input)
  priceListImage?: string | null;
}

const INITIAL_NEW_LOG_DATA: NewLogData = {
  farmName: '',
  contact: '',
  address: '', // Add address
  searchKeyword: '',
  source: '',
  memo: '',
  products: '', // Add products (empty string)
  priceListImage: '' // Use empty string for input binding
};

// Helper function to format timestamp
const formatTimestamp = (isoString: string) => {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    // Example format: YYYY-MM-DD HH:MM:SS (adjust locale/options as needed)
    return date.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    console.error("Error formatting timestamp:", e);
    return 'Invalid Date';
  }
};

export default function CallLogPage() {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [error, setError] = useState<string | null>(null); // Add error state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Renamed for clarity
  const [newLogData, setNewLogData] = useState<NewLogData>(INITIAL_NEW_LOG_DATA);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false); // State for image modal
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null); // State for selected image URL
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Filter States
  const [farmNameFilter, setFarmNameFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState(''); // Add address filter
  const [keywordFilter, setKeywordFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [productFilter, setProductFilter] = useState(''); // Add product filter

  // Function to fetch logs
  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/call-logs');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setLogs(data);
    } catch (e: any) {
      console.error("Error fetching logs:", e);
      setError("통화 기록을 불러오는 중 오류가 발생했습니다.");
      setLogs([]); // Clear logs on error
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial log data using fetch
  useEffect(() => {
    fetchLogs();
  }, []);

  // --- Add Log Handlers ---
  const handleOpenLogModal = () => {
    setNewLogData(INITIAL_NEW_LOG_DATA);
    setIsAddModalOpen(true);
  };

  const handleCloseLogModal = () => {
    setIsAddModalOpen(false);
  };

  const handleAddLogSubmit = async (formData: NewLogData) => {
    // Basic validation (example)
    if (!formData.farmName && !formData.contact) {
      alert('업체명 또는 전화번호 중 하나는 입력해야 합니다.');
      return;
    }
    
    // Create FormData object
    const submissionData = new FormData();

    // Append text fields (including address and products string)
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) { // Ensure all relevant fields are appended
        submissionData.append(key, value as string);
      }
    });

    // Append the actual file if selected
    if (selectedFile) {
      submissionData.append('priceListImage', selectedFile); 
    }

    try {
      const response = await fetch('/api/call-logs', {
        method: 'POST',
        // No 'Content-Type' header needed for FormData, browser sets it
        body: submissionData, // Send FormData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setSelectedFile(null); // Clear selected file state
      fetchLogs(); 
      handleCloseLogModal();
    } catch (e: any) {
      console.error("Error adding log:", e);
      alert('통화 기록 추가 중 오류가 발생했습니다: ' + e.message);
    }
  };

  // Delete Log Handler using fetch
  const handleDeleteLog = async (id: number) => {
     if (window.confirm(`ID ${id} 기록을 삭제하시겠습니까?`)) {
       try {
         const response = await fetch(`/api/call-logs?id=${id}`, {
           method: 'DELETE',
         });
         if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
         }
         // Refresh logs after successful deletion
         fetchLogs(); 
       } catch (e: any) {
         console.error("Error deleting log:", e);
         alert('통화 기록 삭제 중 오류가 발생했습니다: ' + e.message);
       }
     }
  };

  // --- Image Modal Handlers ---
  const handleImageClick = (imageUrl: string | null) => {
    if (imageUrl) { 
      setSelectedImageUrl(imageUrl);
      setIsImageModalOpen(true);
    }
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImageUrl(null);
  };

  // --- Filtering Logic ---
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (farmNameFilter && !log.farmName?.toLowerCase().includes(farmNameFilter.toLowerCase())) return false;
      if (contactFilter && !log.contact?.includes(contactFilter)) return false; 
      if (addressFilter && !log.address?.toLowerCase().includes(addressFilter.toLowerCase())) return false; // Add address filtering
      if (keywordFilter && !log.searchKeyword?.toLowerCase().includes(keywordFilter.toLowerCase())) return false;
      if (sourceFilter && !log.source?.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      // Add product filtering (check if any product in the array matches)
      if (productFilter && !log.products?.some(product => product.toLowerCase().includes(productFilter.toLowerCase()))) return false;
      return true;
    });
  }, [logs, farmNameFilter, contactFilter, addressFilter, keywordFilter, sourceFilter, productFilter]); // Add dependencies

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>전화 통화 기록</h1>

      {/* Toolbar with Filters and Add button */}
      <div className={styles.toolbar}>
        <div className={styles.filterSection}>
           <div className={styles.filterItem}>
            <label htmlFor="farmName-filter">업체명:</label>
            <input id="farmName-filter" type="text" value={farmNameFilter} onChange={e => setFarmNameFilter(e.target.value)} placeholder="업체명 검색..." />
          </div>
           <div className={styles.filterItem}>
            <label htmlFor="contact-filter">전화번호:</label>
            <input id="contact-filter" type="text" value={contactFilter} onChange={e => setContactFilter(e.target.value)} placeholder="전화번호 검색..." />
          </div>
           <div className={styles.filterItem}>
             <label htmlFor="address-filter">주소:</label>
             <input id="address-filter" type="text" value={addressFilter} onChange={e => setAddressFilter(e.target.value)} placeholder="주소 검색..." />
           </div>
           <div className={styles.filterItem}>
            <label htmlFor="keyword-filter">키워드:</label>
            <input id="keyword-filter" type="text" value={keywordFilter} onChange={e => setKeywordFilter(e.target.value)} placeholder="키워드 검색..." />
          </div>
           <div className={styles.filterItem}>
            <label htmlFor="source-filter">유입경로:</label>
            <input id="source-filter" type="text" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} placeholder="유입경로 검색..." />
          </div>
           <div className={styles.filterItem}> {/* Add Product Filter Input */}
             <label htmlFor="product-filter">상품:</label>
             <input id="product-filter" type="text" value={productFilter} onChange={e => setProductFilter(e.target.value)} placeholder="상품 검색..." />
           </div>
        </div>
         <button onClick={handleOpenLogModal} className={styles.addButton}>
          + 통화 기록 추가
        </button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>} {/* Display error message */}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>업체명</th>
              <th>전화번호</th>
              <th>주소</th>
              <th>검색 키워드</th>
              <th>유입 경로</th>
              <th>상품 리스트</th>
              <th>메모</th>
              <th>가격표</th>
              <th>기록 시간</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '1rem' }}>로딩 중...</td></tr>
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.farmName || '-'}</td>
                  <td>{log.contact || '-'}</td>
                  <td>{log.address || '-'}</td>
                  <td>{log.searchKeyword || '-'}</td>
                  <td>{log.source || '-'}</td>
                  <td>{log.products?.join(', ') || '-'}</td>
                  <td className={styles.memoCell}>{log.memo || '-'}</td>
                  <td>
                    {/* Use the path directly for the image src */}
                    {log.priceListImage ? (
                      <>
                        <img 
                          src={log.priceListImage} 
                          alt={`${log.farmName || 'Log'} 가격표`} 
                          className={styles.priceImage} 
                          onClick={() => handleImageClick(log.priceListImage)} // Still allow click for modal
                          style={{ cursor: 'pointer' }} 
                          onError={(e) => { 
                            const imgElement = e.target as HTMLImageElement;
                            imgElement.style.display = 'none'; 
                            imgElement.nextElementSibling?.classList.remove(styles.hidden);
                          }} // Hide img on error, show span
                        />
                        {/* Hidden text shown if image fails to load */}
                        <span className={`${styles.imageError} ${styles.hidden}`}>{log.priceListImage} (이미지 로드 실패)</span>
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td>
                    <button 
                      onClick={() => handleDeleteLog(log.id)}
                      className={styles.deleteButton}
                      aria-label={`Delete log ${log.id}`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '1rem' }}>통화 기록이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Adding Log */}
      <Modal isOpen={isAddModalOpen} onClose={handleCloseLogModal}>
        <AddLogForm
          formData={newLogData}
          setFormData={setNewLogData}
          onSubmit={handleAddLogSubmit}
          onCancel={handleCloseLogModal}
          setSelectedFile={setSelectedFile}
        />
      </Modal>

      {/* Modal for Viewing Image */}
      {selectedImageUrl && (
        <Modal isOpen={isImageModalOpen} onClose={handleCloseImageModal}>
          <img 
            src={selectedImageUrl} 
            alt="확대된 가격표 이미지" 
            className={styles.modalImage} 
            onError={(e) => { 
              const imgElement = e.target as HTMLImageElement;
              imgElement.alt = "이미지를 로드할 수 없습니다."; 
              // Optionally, hide the broken image icon
              // imgElement.style.display = 'none'; 
            }} // Update alt text on error
          />
        </Modal>
      )}
    </div>
  );
} 