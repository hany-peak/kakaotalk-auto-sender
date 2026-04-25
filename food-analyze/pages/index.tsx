import React, { useState, useMemo } from 'react';
import { 농산물_카테고리 } from '../keywords.js'; // Ensure this path is correct
import { agriculturalDB } from '../agricultural-products.js'; // Ensure this path is correct
import styles from './Home.module.css'; // Ensure Home.module.css exists in the same directory

// Helper function to calculate seasonal periods for a product
const calculateSeasons = (product: string, months: string[]) => {
  const seasons: { start: number, duration: number }[] = [];
  let currentSeasonStart = -1;
  let currentDuration = 0;

  months.forEach((month, index) => {
    const monthlyProducts = agriculturalDB.getMonthlyProducts(month);
    // Check if the product is in season for the current month, regardless of category
    const isInThisMonth = Object.values(monthlyProducts).flat().includes(product);

    if (isInThisMonth) {
      if (currentSeasonStart === -1) {
        currentSeasonStart = index; // Mark the start of a new season block
      }
      currentDuration++; // Increment duration for the current block
    } else {
      if (currentSeasonStart !== -1) {
        // End of the current season block, push it to the list
        seasons.push({ start: currentSeasonStart, duration: currentDuration });
        currentSeasonStart = -1; // Reset for the next block
        currentDuration = 0;
      }
    }
  });

  // If a season block was ongoing until the end of the year, add it
  if (currentSeasonStart !== -1) {
    seasons.push({ start: currentSeasonStart, duration: currentDuration });
  }
  return seasons;
};

export default function Home() {
  const months = [
    "1월", "2월", "3월", "4월", "5월", "6월",
    "7월", "8월", "9월", "10월", "11월", "12월"
  ];

  // State for selected month filter
  const [selectedMonth, setSelectedMonth] = useState<string>('전체');

  // Fetch all products initially
  const allFruits = useMemo(() => agriculturalDB.getAllFruits().sort(), []);
  const allVegetables = useMemo(() => agriculturalDB.getAllVegetables().sort(), []);
  const allOthers = useMemo(() => agriculturalDB.getAllOthers().sort(), []);

  // Filter products based on selected month
  const filteredProducts = useMemo(() => {
    if (selectedMonth === '전체') {
      return {
        fruits: allFruits,
        vegetables: allVegetables,
        others: allOthers,
      };
    }
    const productsInSelectedMonth = Object.values(agriculturalDB.getMonthlyProducts(selectedMonth)).flat();
    return {
      fruits: allFruits.filter(p => productsInSelectedMonth.includes(p)),
      vegetables: allVegetables.filter(p => productsInSelectedMonth.includes(p)),
      others: allOthers.filter(p => productsInSelectedMonth.includes(p)),
    };
  }, [selectedMonth, allFruits, allVegetables, allOthers]);

  // Group filtered products by category
  const groupedProducts = useMemo(() => [
    { category: 농산물_카테고리.과일, products: filteredProducts.fruits, styleSuffix: 'Fruit' },
    { category: 농산물_카테고리.채소, products: filteredProducts.vegetables, styleSuffix: 'Vegetable' },
    { category: 농산물_카테고리.기타, products: filteredProducts.others, styleSuffix: 'Other' },
  ].filter(group => group.products.length > 0), [filteredProducts]); // Only include categories with products

  // Pre-calculate the seasonal periods for each product using React.useMemo for optimization
  const productSeasonsData = useMemo(() => {
    const data: { [product: string]: { seasons: { start: number, duration: number }[] } } = {};
    [...allFruits, ...allVegetables, ...allOthers].forEach(product => {
      const seasons = calculateSeasons(product, months);
      data[product] = {
        seasons: seasons
      };
      // --- Debugging Specific Product ---
      if (product === "호박고구마") {
        console.log(`호박고구마 Seasons Data:`, seasons);
      }
      // --- End Debugging ---
    });
    // --- Debugging Console Log ---
    // console.log("Calculated Seasons Data:", data);
    // --- End Debugging ---
    return data;
  }, [months, allFruits, allVegetables, allOthers]);

  // Define category emojis (styles are handled by CSS Modules)
  const categoryEmojis = {
    [농산물_카테고리.과일]: "🍎",
    [농산물_카테고리.채소]: "🥬",
    [농산물_카테고리.기타]: "🌾"
  };

  // Calculate total rows based on *filtered* products
  const totalRows = 1 + groupedProducts.length + 
                    filteredProducts.fruits.length + 
                    filteredProducts.vegetables.length + 
                    filteredProducts.others.length;

  // Handle filter change
  const handleMonthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(event.target.value);
  };

  return (
    <div className={styles.container}> 
      <h1 className={styles.title}>
        제철 농산물 간트 차트
      </h1>

      {/* Month Filter */}    
      <div className={styles.filterContainer}> {/* Add styling for filter */} 
        <label htmlFor="month-select" className={styles.filterLabel}>월 선택: </label>
        <select id="month-select" value={selectedMonth} onChange={handleMonthChange} className={styles.filterSelect}>
          <option value="전체">전체</option>
          {months.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      </div>

      {/* Grid container with overflow for horizontal scrolling */}
      <div className={styles.gridContainer}>
        <div 
          className={styles.grid}
          style={{
            // Define grid columns: auto for product names, 1fr for each month (min 4rem)
            gridTemplateColumns: 'auto repeat(12, minmax(4rem, 1fr))', 
            // gridTemplateRows is now implicitly defined by content and min-height in CSS
          }}
        >
          {/* --- Grid Header Row (Months) --- */}
          <div className={styles.headerCell} style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}>농산물</div>
          {months.map((month, index) => (
            // Month header cell
            <div key={month} 
                 className={`${styles.monthHeaderCell} ${selectedMonth === month ? styles.selectedMonthHeader : ''}`} // Highlight selected month
                 style={{ gridColumn: `${index + 2} / span 1`, gridRow: '1 / 2' }}>
              {month}
            </div>
          ))}

          {/* --- Grid Body (Product Rows Grouped by Category) --- */}
          {(() => {
            let currentRowIndex = 2; // Start grid row index after the header row
            
            return groupedProducts.map(({ category, products, styleSuffix }) => {
              if (products.length === 0) return null; // Skip category if no products after filter
              
              const categoryHeaderRow = currentRowIndex++; // Assign row index for the category header
              
              const productElements = products.flatMap((product) => {
                const productRowIndex = currentRowIndex++; // Assign row index for the product
                const productData = productSeasonsData[product]; // Get pre-calculated season data
                
                // 1. Render the Product Name Cell
                const nameCell = (
                  <div key={`${product}-name`}
                       className={`${styles.productNameCell} ${styles[`productName${styleSuffix}`]}`} 
                       style={{ gridColumn: '1 / 2', gridRow: `${productRowIndex} / span 1` }}>
                    {product}
                  </div>
                );

                // 2. Render the Background Month Cells
                const backgroundCells = months.map((_, index) => (
                  <div key={`${product}-month-${index}`} 
                       className={`${styles.monthBackgroundCell} ${styles[`monthBackground${styleSuffix}`]}`} 
                       style={{ gridColumn: `${index + 2} / span 1`, gridRow: `${productRowIndex} / span 1` }}>&nbsp;</div>
                ));

                // 3. Render the Season Bars on top
                const seasonBars = productData?.seasons.map((season, seasonIdx) => (
                  <div
                    key={`${product}-season-${seasonIdx}`}
                    className={`${styles.seasonBar} ${styles[`seasonBar${styleSuffix}`]}`}
                    style={{
                      gridColumn: `${season.start + 2} / span ${season.duration}`,
                      gridRow: `${productRowIndex} / span 1`
                    }}
                    title={product}
                  >
                    {product} 
                  </div>
                ));

                // Return all elements for this product row in the correct order
                return [nameCell, ...backgroundCells, ...(seasonBars || [])];
              });

              // Render the Category Header first
              const categoryHeader = (
                <div key={`${category}-header`}
                     className={`${styles.categoryHeaderCell} ${styles[`categoryHeader${styleSuffix}`]}`} 
                     style={{ gridColumn: '1 / -1', gridRow: `${categoryHeaderRow} / span 1` }}>
                  {categoryEmojis[category]} {category}
                </div>
              );

              // Return Category Header + all product elements for this category
              return [categoryHeader, ...productElements];
            }).filter(Boolean); // Filter out null values
          })()}
        </div>
      </div>
    </div>
  );
}



