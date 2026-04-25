import React, { useState, useMemo, useEffect } from 'react';
const { farmSourcingDB } = require('../farm-house.js'); // Corrected path to import directly from farm-house.js
const { 농산물_카테고리 } = require('../keywords.js'); // Import categories
import styles from './Sourcing.module.css'; // Import CSS Module
import Modal from '../components/Modal'; // Import Modal - Reverted
import AddFarmForm from '../components/AddFarmForm'; // Import Form - Reverted

// Define a type/interface for farm data for better type safety
interface FarmData {
  id?: number; 
  category: string;
  product: string;
  farmName: string;
  address: string;
  contact: string;
  source: string;
  price?: number | string; // Allow string for input flexibility
  minOrder?: number | string; // Allow string for input flexibility
  memo?: string;
  year?: number; // Add year field
  // Add other fields from farm-house.js if needed in the form
}

const currentYear = new Date().getFullYear();
const INITIAL_NEW_FARM_DATA: Partial<FarmData> = {
  category: 농산물_카테고리.과일, // Default category
  product: '',
  farmName: '',
  address: '',
  contact: '',
  source: '',
  price: '', 
  minOrder: '',
  memo: '',
  year: currentYear // Default new farms to current year
};

export default function SourcingPage() {
  // --- State Management ---
  const [farms, setFarms] = useState<FarmData[]>([]); // State for the list of farms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFarmData, setNewFarmData] = useState<Partial<FarmData>>(INITIAL_NEW_FARM_DATA);

  // Filter States
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(''); // '' means all
  const [farmNameFilter, setFarmNameFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [yearFilter, setYearFilter] = useState<string>(''); // Add year filter state (string for input)

  // Load initial farm data on component mount
  useEffect(() => {
    setFarms(farmSourcingDB.getAllFarms());
  }, []);

  // Filtered Data Calculation (Depends on 'farms' state now)
  const filteredFarms = useMemo(() => {
    const yearFilterNum = yearFilter ? parseInt(yearFilter, 10) : null;
    return farms.filter(farm => {
      // Product Name Filter (case-insensitive)
      if (productFilter && !farm.product?.toLowerCase().includes(productFilter.toLowerCase())) {
        return false;
      }
      // Category Filter
      if (categoryFilter && farm.category !== categoryFilter) {
        return false;
      }
      // Farm Name Filter (case-insensitive)
      if (farmNameFilter && !farm.farmName?.toLowerCase().includes(farmNameFilter.toLowerCase())) {
        return false;
      }
      // Address Filter (case-insensitive)
      if (addressFilter && !farm.address?.toLowerCase().includes(addressFilter.toLowerCase())) {
        return false;
      }
      // Source Filter (case-insensitive)
      if (sourceFilter && !farm.source?.toLowerCase().includes(sourceFilter.toLowerCase())) {
        return false;
      }
      // Year Filter
      if (yearFilterNum !== null && farm.year !== yearFilterNum) {
        return false;
      }
      // Add more filter conditions here...
      return true; // Pass all filters
    });
  }, [farms, productFilter, categoryFilter, farmNameFilter, addressFilter, sourceFilter, yearFilter]);

  // --- Event Handlers ---
  const handleOpenModal = () => {
    setNewFarmData(INITIAL_NEW_FARM_DATA); // Reset form data when opening
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddFarmSubmit = (formData: Partial<FarmData>) => {
    // Basic validation (example: ensure required fields are not empty)
    if (!formData.product || !formData.farmName || !formData.category) {
      alert('상품명, 업체명, 카테고리는 필수 입력 항목입니다.');
      return;
    }
    
    // Convert price/minOrder/year back to numbers if they are not empty strings
    const dataToAdd = {
      ...formData,
      price: formData.price ? Number(formData.price) : undefined,
      minOrder: formData.minOrder ? Number(formData.minOrder) : undefined,
      year: formData.year ? Number(formData.year) : undefined // Ensure year is number or undefined
    };

    try {
      farmSourcingDB.addFarm(dataToAdd);
      setFarms(farmSourcingDB.getAllFarms()); // Refresh the list from the source
      handleCloseModal();
    } catch (error) {
      console.error("Error adding farm:", error);
      alert('농가 정보 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteFarm = (id?: number) => {
    if (id === undefined) {
      console.error("Cannot delete farm with undefined id");
      return;
    }
    // Confirmation dialog
    if (window.confirm(`ID ${id} 농가 정보를 정말 삭제하시겠습니까?`)) {
      try {
        const deleted = farmSourcingDB.deleteFarm(id);
        if (deleted) {
          // Refresh the list from the source after deletion
          setFarms(farmSourcingDB.getAllFarms()); 
        } else {
          console.warn(`Farm with id ${id} not found for deletion.`);
        }
      } catch (error) {
        console.error("Error deleting farm:", error);
        alert('농가 정보 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>농가 소싱 리스트</h1>
      
      <div className={styles.toolbar}> {/* Container for buttons/filters */} 
        {/* Filter Section */}
        <div className={styles.filterSection}>
          <div className={styles.filterItem}>
            <label htmlFor="product-filter">상품명:</label>
            <input id="product-filter" type="text" value={productFilter} onChange={e => setProductFilter(e.target.value)} placeholder="상품명 검색..." />
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="category-filter">카테고리:</label>
            <select id="category-filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">전체</option>
              {Object.values(농산물_카테고리).map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="farmName-filter">업체명:</label>
            <input id="farmName-filter" type="text" value={farmNameFilter} onChange={e => setFarmNameFilter(e.target.value)} placeholder="업체명 검색..." />
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="address-filter">지역:</label>
            <input id="address-filter" type="text" value={addressFilter} onChange={e => setAddressFilter(e.target.value)} placeholder="지역 검색..." />
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="source-filter">유입 경로:</label>
            <input id="source-filter" type="text" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} placeholder="유입 경로 검색..." />
          </div>
          <div className={styles.filterItem}>
            <label htmlFor="year-filter">연도:</label>
            <input 
              id="year-filter" 
              type="number" 
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)} 
              placeholder="연도 검색..."
              min="2000" // Optional: set min year
              max={currentYear + 1} // Optional: set max year
              step="1" 
            />
          </div>
        </div>
        
        {/* Add Button */}
        <button onClick={handleOpenModal} className={styles.addButton}>
          + 농가 추가
        </button>
      </div>

      {/* Table Section */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>상품명</th>
              <th>카테고리</th>
              <th>업체명</th>
              <th>지역</th>
              <th>연락처</th>
              <th>유입 경로</th>
              <th>연도</th>
              <th>가격 (원)</th>
              <th>최소 수량 (kg)</th>
              <th>메모</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredFarms.map((farm) => (
              <tr key={farm.id}>
                <td>{farm.id || '-'}</td>
                <td>{farm.product || '-'}</td>
                <td>{farm.category || '-'}</td>
                <td>{farm.farmName || '-'}</td>
                <td>{farm.address || '-'}</td>
                <td>{farm.contact || '-'}</td>
                <td>{farm.source || '-'}</td>
                <td>{farm.year || '-'}</td>
                <td>{farm.price ? farm.price.toLocaleString() : '-'}</td>
                <td>{farm.minOrder || '-'}</td>
                <td>{farm.memo || '-'}</td>
                <td>
                  <button 
                    onClick={() => handleDeleteFarm(farm.id)} 
                    className={styles.deleteButton}
                    aria-label={`Delete farm ${farm.id}`}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal for Adding Farm */} 
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <AddFarmForm 
          formData={newFarmData} 
          setFormData={(data: Partial<FarmData>) => setNewFarmData(data)}
          onSubmit={handleAddFarmSubmit}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
} 