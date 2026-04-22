const { 농산물_카테고리 } = require('./keywords.js');

// Rename the main object to farmSourcingDB
const farmSourcingDB = {
  farms: [
    {
      id: 1,
      category: 농산물_카테고리.과일,
      product: "부사사과",
      farmName: "청송사과농장",
      address: "경북 청송군 청송읍",
      area: 200, // 평
      contact: "010-1234-5678",
      source: "지인소개",
      price: 35000, // 5kg 기준
      output: 5000, // kg/년
      minOrder: 100, // kg
      memo: "청송 지역 대표 사과농장",
      inSeasonMonths: ["1월", "10월", "11월", "12월"],
      year: 2024
    },
    {
      id: 2, 
      category: 농산물_카테고리.과일,
      product: "한라봉",
      farmName: "제주감귤원",
      address: "제주시 애월읍",
      area: 150,
      contact: "010-2345-6789", 
      source: "농업박람회",
      price: 45000, // 3kg 기준
      output: 3000,
      minOrder: 50,
      memo: "유기농 인증 보유",
      inSeasonMonths: ["1월", "2월", "3월", "11월", "12월"],
      year: 2024
    },
    {
      id: 3,
      category: 농산물_카테고리.채소,
      product: "시금치",
      farmName: "푸른들농장",
      address: "전남 해남군",
      area: 300,
      contact: "010-3456-7890",
      source: "농협소개",
      price: 25000, // 2kg 기준
      output: 8000,
      minOrder: 30,
      memo: "친환경 무농약 재배",
      inSeasonMonths: ["1월", "2월", "11월", "12월"],
      year: 2024
    }
  ],

  addFarm(farmData) {
    // Make sure 'this' refers to the farmSourcingDB object itself
    const farmsArray = this.farms; 
    const newId = farmsArray.length > 0 
      ? Math.max(...farmsArray.map(f => f.id)) + 1 
      : 1;
      
    const currentYear = new Date().getFullYear();

    const newFarm = {
      id: newId,
      category: farmData.category || '' ,
      product: farmData.product || '' ,
      farmName: farmData.farmName || '' ,
      address: farmData.address || '' ,
      contact: farmData.contact || '' ,
      source: farmData.source || '' ,
      price: farmData.price, 
      minOrder: farmData.minOrder, 
      memo: farmData.memo || '' ,
      year: farmData.year ? Number(farmData.year) : currentYear
    };
    
    farmsArray.push(newFarm);
    return newFarm;
  },

  // Define getAllFarms method directly here
  getAllFarms() {
    return JSON.parse(JSON.stringify(this.farms));
  },

  getFarmsByProduct(productName) {
    return this.farms.filter(farm => farm.product === productName);
  },

  getFarmsByMonth(month) {
    // Assuming inSeasonMonths exists, need to add it back if removed previously
    return this.farms.filter(farm => farm.inSeasonMonths && farm.inSeasonMonths.includes(month));
  },

  updateFarmInfo(id, updateData) {
    const farmIndex = this.farms.findIndex(farm => farm.id === id);
    if (farmIndex !== -1) {
      this.farms[farmIndex] = {
        ...this.farms[farmIndex],
        ...updateData
      };
    }
  },

  // Add deleteFarm method
  deleteFarm(id) {
    const initialLength = this.farms.length;
    this.farms = this.farms.filter(farm => farm.id !== id);
    // Return true if an item was deleted, false otherwise
    return this.farms.length < initialLength; 
  }
};

// Remove the incorrect instantiation
// const farmSourcingDB = new FarmSourcingDB(); 

// Export the object using the consistent name
module.exports = { farmSourcingDB };
