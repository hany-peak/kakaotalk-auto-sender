import React from 'react';
import styles from './AddFarmForm.module.css';
const { 농산물_카테고리 } = require('../keywords.js'); // Import categories

// Define the type for farm data passed to the form
interface FarmData {
  id?: number;
  category: string;
  product: string;
  farmName: string;
  address: string;
  contact: string;
  source: string;
  price?: number | string; // Use string for input flexibility
  minOrder?: number | string; // Use string for input flexibility
  memo?: string;
  year?: number | string; // Allow string | number to match state setter
}

interface AddFarmFormProps {
  formData: Partial<FarmData>; // Use Partial as not all fields might be initially present
  setFormData: (data: Partial<FarmData>) => void;
  onSubmit: (data: Partial<FarmData>) => void;
  onCancel: () => void;
}

const AddFarmForm: React.FC<AddFarmFormProps> = ({ formData, setFormData, onSubmit, onCancel }) => {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.formContainer}>
      <h2 className={styles.formTitle}>새 농가 정보 추가</h2>

      {/* Form Fields */}
      <div className={styles.formGrid}>
        {/* Product */}
        <div className={styles.formField}>
          <label htmlFor="product">상품명 <span className={styles.required}>*</span></label>
          <input type="text" id="product" name="product" value={formData.product || ''} onChange={handleChange} required />
        </div>

        {/* Category */}
        <div className={styles.formField}>
          <label htmlFor="category">카테고리 <span className={styles.required}>*</span></label>
          <select id="category" name="category" value={formData.category || ''} onChange={handleChange} required>
            {Object.values(농산물_카테고리).map((cat: any) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Farm Name */}
        <div className={styles.formField}>
          <label htmlFor="farmName">업체명 <span className={styles.required}>*</span></label>
          <input type="text" id="farmName" name="farmName" value={formData.farmName || ''} onChange={handleChange} required />
        </div>

        {/* Address */}
        <div className={styles.formField}>
          <label htmlFor="address">지역</label>
          <input type="text" id="address" name="address" value={formData.address || ''} onChange={handleChange} />
        </div>

        {/* Contact */}
        <div className={styles.formField}>
          <label htmlFor="contact">연락처</label>
          <input type="text" id="contact" name="contact" value={formData.contact || ''} onChange={handleChange} />
        </div>

        {/* Source */}
        <div className={styles.formField}>
          <label htmlFor="source">유입 경로</label>
          <input type="text" id="source" name="source" value={formData.source || ''} onChange={handleChange} />
        </div>

        {/* Price */}
        <div className={styles.formField}>
          <label htmlFor="price">가격 (원)</label>
          <input type="number" id="price" name="price" value={formData.price || ''} onChange={handleChange} placeholder="숫자만 입력"/>
        </div>

        {/* Min Order */}
        <div className={styles.formField}>
          <label htmlFor="minOrder">최소 수량 (kg)</label>
          <input type="number" id="minOrder" name="minOrder" value={formData.minOrder || ''} onChange={handleChange} placeholder="숫자만 입력"/>
        </div>

        {/* Year */}
        <div className={styles.formField}>
          <label htmlFor="year">연도</label>
          <input 
            type="number" 
            id="year" 
            name="year" 
            value={formData.year || ''} 
            onChange={handleChange} 
            placeholder="예: 2024" 
            min="2000" // Optional: Consistent with filter
            max={new Date().getFullYear() + 5} // Optional: Allow a few future years
            step="1"
          />
        </div>
      </div>

        {/* Memo (Full Width) */}
        <div className={`${styles.formField} ${styles.fullWidth}`}>
          <label htmlFor="memo">메모</label>
          <textarea id="memo" name="memo" value={formData.memo || ''} onChange={handleChange} rows={3}></textarea>
        </div>

      {/* Form Actions */}
      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>취소</button>
        <button type="submit" className={styles.submitButton}>저장</button>
      </div>
    </form>
  );
};

export default AddFarmForm; 