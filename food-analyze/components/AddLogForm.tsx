import React, { useState } from 'react';
import styles from './AddLogForm.module.css';

// Type for the form data being handled
interface LogFormData {
  farmName?: string;
  contact?: string;
  address?: string;
  searchKeyword?: string;
  source?: string;
  memo?: string;
  products?: string;
  // priceListImage is handled separately via selectedFile state in parent
}

interface AddLogFormProps {
  formData: Omit<LogFormData, 'priceListImage'>; // Exclude priceListImage from formData prop type
  setFormData: (data: Omit<LogFormData, 'priceListImage'>) => void;
  onSubmit: (data: Omit<LogFormData, 'priceListImage'>) => void;
  onCancel: () => void;
  setSelectedFile: (file: File | null) => void; // Prop to lift file up
}

const AddLogForm: React.FC<AddLogFormProps> = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel, 
  setSelectedFile 
}) => {

  // Local state to display the chosen filename
  const [localFilename, setLocalFilename] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'file') {
      const inputElement = e.target as HTMLInputElement;
      if (inputElement.files && inputElement.files[0]) {
        const file = inputElement.files[0];
        setSelectedFile(file); // Lift the File object up to the parent
        setLocalFilename(file.name); // Update local display
      } else {
        setSelectedFile(null); // Clear file in parent state
        setLocalFilename(''); // Clear local display
      }
    } else {
      // Handle other input types (excluding priceListImage)
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit only the text formData. The file is handled by the parent's selectedFile state.
    onSubmit(formData);
    setLocalFilename(''); // Clear local filename on submit
  };

  // Need to clear filename on cancel too
  const handleCancel = () => {
      onCancel();
      setLocalFilename('');
      setSelectedFile(null);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formContainer}>
      <h2 className={styles.formTitle}>새 통화 기록 추가</h2>

      <div className={styles.formField}>
        <label htmlFor="farmName">업체명</label>
        <input type="text" id="farmName" name="farmName" value={formData.farmName || ''} onChange={handleChange} />
      </div>

      <div className={styles.formField}>
        <label htmlFor="contact">전화번호</label>
        <input type="text" id="contact" name="contact" value={formData.contact || ''} onChange={handleChange} />
      </div>

      <div className={styles.formField}>
        <label htmlFor="address">주소</label>
        <input type="text" id="address" name="address" value={formData.address || ''} onChange={handleChange} />
      </div>

      <div className={styles.formField}>
        <label htmlFor="searchKeyword">검색 키워드</label>
        <input type="text" id="searchKeyword" name="searchKeyword" value={formData.searchKeyword || ''} onChange={handleChange} />
      </div>

      <div className={styles.formField}>
        <label htmlFor="source">유입 경로</label>
        <input type="text" id="source" name="source" value={formData.source || ''} onChange={handleChange} />
      </div>

      <div className={styles.formField}>
        <label htmlFor="products">상품 리스트 (쉼표로 구분)</label>
        <input type="text" id="products" name="products" value={formData.products || ''} onChange={handleChange} placeholder="예: 사과, 배, 상추" />
      </div>

      <div className={styles.formField}>
        <label htmlFor="memo">메모</label>
        <textarea id="memo" name="memo" value={formData.memo || ''} onChange={handleChange} rows={4}></textarea>
      </div>

      <div className={styles.formField}>
        <label htmlFor="priceListImage">가격표 (이미지 파일)</label>
        {localFilename && <p className={styles.fileNameDisplay}>선택된 파일: {localFilename}</p>}
        <input
          type="file"
          id="priceListImage"
          name="priceListImage" // Name matches the key expected by formidable on the backend
          onChange={handleChange}
          accept="image/*"
        />
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={handleCancel} className={styles.cancelButton}>취소</button>
        <button type="submit" className={styles.submitButton}>저장</button>
      </div>
    </form>
  );
};

export default AddLogForm; 