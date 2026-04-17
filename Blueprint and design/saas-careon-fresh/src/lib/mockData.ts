export interface AccountData {
  name: string;
  color: string;
  dailyRevenue: number[];
  salesHistory: number[];
  marginPercent: number;
}

export const ACCOUNTS: Record<string, AccountData> = {
  "Boutique Alice": {
    name: "Boutique Alice",
    color: "#8B5CF6",
    salesHistory: [12, 10, 14, 11, 15, 10, 13, 12, 14, 11, 15, 10, 14, 12, 13, 11, 15, 10],
    dailyRevenue: [
      320, 280, 350, 310, 380, 295, 340, 315, 360, 325, 370, 290, 355, 330,
      345, 310, 385, 298, 365, 320, 350, 305, 340, 315, 375, 330, 360, 295,
      340, 325, 370, 310, 355, 295, 365, 320, 350, 305, 375, 330, 365, 310,
      355, 325, 370, 305, 360, 315, 345, 300, 370, 325, 355, 310, 365, 330,
      350, 315, 380, 295, 360, 325, 345, 310, 375, 295, 360, 320, 350, 305,
      370, 325, 355, 310, 365, 320, 350, 305, 360, 315, 375, 295, 355, 310,
      365, 325, 350, 310, 370, 295, 360, 320, 345, 310, 365, 325, 350, 305,
      375, 315, 360, 295, 355, 320, 370, 310, 350, 315, 365, 300, 375, 325,
      360, 310, 355, 295, 370, 320, 350, 305, 365, 315, 360, 325, 370, 310,
      355, 295, 365, 320, 350, 305, 375, 330, 360, 315, 355, 300, 370, 325,
      360, 310, 365, 320, 350, 305, 375, 315, 360, 295, 355, 310, 370, 325,
      350, 310, 365, 320, 360, 305, 375, 315, 355, 300, 370, 325, 360, 310,
      365, 315, 350, 295, 375, 320, 360, 305, 355, 315, 370, 310, 365, 325,
      350, 305, 360, 320, 375, 295, 365, 310, 355, 315, 370, 305, 360, 320,
      350, 315, 365, 300, 375, 325, 360, 310, 355, 295, 370, 320, 365, 305,
      350, 315, 360, 325, 375, 310, 355, 295, 370, 315, 360, 305, 365, 320,
      350, 310, 375, 295, 360, 325, 355, 310, 370, 315, 365, 300, 350, 320,
      375, 310, 360, 295, 365, 320, 355, 305, 370, 315, 360, 310, 365, 325,
      350, 295, 375, 320, 360, 305, 355, 315, 370, 300, 365, 325, 360, 310,
      350, 315, 375, 305, 360, 320, 365, 295, 355, 310, 370, 325, 360, 315,
      365, 300, 350, 320, 375, 310, 360, 295, 365, 315, 355, 305, 370, 320,
      360, 310, 365, 325, 350, 295, 375, 315, 360, 305, 355, 320, 370, 310,
      365, 295, 350, 325, 360, 315, 375, 300, 365, 310, 355, 320, 370, 305,
      360, 315, 365, 325, 350, 310, 375, 295, 360, 320, 365, 305, 355, 315,
      370, 310, 360, 325, 365, 295, 350, 320, 375, 310, 360, 305, 365, 315,
      355, 300, 370, 325, 360, 310, 365, 320, 350, 305, 375, 315, 360
    ],
    marginPercent: 38,
  },
  "Frip Tim": {
    name: "Frip Tim",
    color: "#22D3EE",
    salesHistory: [9, 8, 10, 9, 11, 8, 10, 9, 11, 8, 10, 9, 11, 8, 10, 9, 11, 8],
    dailyRevenue: [
      230, 210, 255, 225, 270, 215, 245, 220, 260, 230, 265, 210, 250, 235,
      255, 220, 275, 215, 260, 230, 250, 220, 245, 225, 270, 235, 260, 215,
      245, 230, 265, 225, 255, 215, 260, 230, 250, 220, 270, 235, 260, 225,
      255, 230, 265, 220, 260, 225, 250, 215, 265, 230, 255, 220, 260, 235,
      250, 225, 270, 215, 260, 230, 250, 220, 270, 215, 260, 230, 250, 220,
      265, 230, 255, 225, 260, 230, 250, 220, 260, 225, 270, 215, 255, 220,
      260, 230, 250, 220, 265, 215, 260, 230, 250, 220, 260, 230, 250, 220,
      270, 225, 260, 215, 255, 230, 265, 220, 250, 225, 260, 215, 270, 230,
      260, 220, 255, 215, 265, 230, 250, 220, 260, 225, 260, 230, 265, 220,
      255, 215, 260, 230, 250, 220, 270, 235, 260, 225, 255, 215, 265, 230,
      260, 220, 260, 230, 250, 220, 270, 225, 260, 215, 255, 220, 265, 230,
      250, 220, 260, 230, 260, 220, 270, 225, 255, 215, 265, 230, 260, 220,
      260, 225, 250, 215, 270, 230, 260, 220, 255, 225, 265, 220, 260, 230,
      250, 220, 260, 230, 270, 215, 260, 220, 255, 225, 265, 220, 260, 230,
      250, 225, 260, 215, 270, 230, 260, 220, 255, 215, 265, 230, 260, 220,
      250, 225, 260, 230, 270, 220, 255, 215, 265, 225, 260, 220, 260, 230,
      250, 220, 270, 215, 260, 230, 255, 220, 265, 225, 260, 215, 250, 230,
      270, 220, 260, 215, 260, 230, 255, 220, 265, 225, 260, 220, 260, 230,
      250, 215, 270, 230, 260, 220, 255, 225, 265, 215, 260, 230, 260, 220,
      250, 225, 270, 220, 260, 230, 260, 215, 255, 220, 265, 230, 260, 225,
      260, 215, 250, 230, 270, 220, 260, 215, 260, 225, 255, 220, 265, 230,
      260, 220, 260, 230, 250, 215, 270, 225, 260, 220, 255, 230, 265, 220,
      260, 215, 250, 230, 260, 225, 270, 215, 260, 220, 255, 230, 265, 220,
      260, 225, 260, 230, 250, 220, 270, 215, 260, 230, 260, 220, 255, 225,
      265, 220, 260, 230, 260, 215, 250, 230, 270, 220, 260, 220, 260, 225,
      255, 215, 265, 230, 260, 220, 260, 230, 250, 220, 270, 225, 260
    ],
    marginPercent: 34,
  },
  "Margo Vintage": {
    name: "Margo Vintage",
    color: "#EC4899",
    salesHistory: [7, 6, 8, 7, 9, 6, 8, 7, 9, 6, 8, 7, 9, 6, 8, 7, 9, 6],
    dailyRevenue: [
      180, 165, 195, 175, 210, 170, 190, 175, 205, 180, 200, 165, 195, 185,
      200, 175, 215, 170, 205, 180, 195, 175, 190, 180, 210, 185, 205, 170,
      190, 180, 200, 175, 195, 170, 205, 180, 195, 175, 210, 185, 205, 175,
      195, 180, 200, 175, 205, 180, 195, 170, 200, 180, 195, 175, 205, 185,
      195, 180, 210, 170, 205, 180, 195, 175, 210, 170, 205, 180, 195, 175,
      200, 180, 195, 175, 205, 180, 195, 175, 205, 180, 210, 170, 195, 175,
      205, 180, 195, 175, 200, 170, 205, 180, 195, 175, 205, 180, 195, 175,
      210, 180, 205, 170, 195, 180, 200, 175, 195, 180, 205, 170, 210, 180,
      205, 175, 195, 170, 200, 180, 195, 175, 205, 180, 205, 180, 200, 175,
      195, 170, 205, 180, 195, 175, 210, 185, 205, 180, 195, 170, 200, 180,
      205, 175, 205, 180, 195, 175, 210, 180, 205, 170, 195, 175, 200, 180,
      195, 175, 205, 180, 205, 175, 210, 180, 195, 170, 200, 180, 205, 175,
      205, 180, 195, 170, 210, 180, 205, 175, 195, 180, 200, 175, 205, 180,
      195, 175, 205, 180, 210, 170, 205, 175, 195, 180, 200, 175, 205, 180,
      195, 180, 205, 170, 210, 180, 205, 175, 195, 170, 200, 180, 205, 175,
      195, 180, 205, 180, 210, 175, 195, 170, 200, 180, 205, 175, 205, 180,
      195, 175, 210, 170, 205, 180, 195, 175, 200, 180, 205, 170, 195, 180,
      210, 175, 205, 170, 205, 180, 195, 175, 200, 180, 205, 175, 205, 180,
      195, 170, 210, 180, 205, 175, 195, 180, 200, 170, 205, 180, 205, 175,
      195, 180, 210, 175, 205, 180, 205, 170, 195, 175, 200, 180, 205, 180,
      205, 170, 195, 180, 210, 175, 205, 170, 205, 180, 195, 175, 200, 180,
      205, 175, 205, 180, 195, 170, 210, 180, 205, 175, 195, 180, 200, 175,
      205, 170, 195, 180, 205, 180, 210, 170, 205, 175, 195, 180, 200, 175,
      205, 180, 205, 180, 195, 175, 210, 170, 205, 180, 205, 175, 195, 180,
      200, 175, 205, 180, 205, 170, 195, 180, 210, 175, 205, 175, 205, 180,
      195, 170, 200, 180, 205, 175, 205, 180, 195, 175, 210, 180, 205
    ],
    marginPercent: 42,
  },
};

export function generateMockData(
  selectedAccounts: string[],
  dateRange: "today" | "yesterday" | "7days" | "30days" | "90days" | "ytd",
  customFrom?: Date,
  customTo?: Date
) {
  const today = new Date("2025-10-29");
  
  // Handle custom date range
  if (customFrom && customTo) {
    const data = [];
    const from = new Date(customFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(customTo);
    to.setHours(0, 0, 0, 0);
    
    // Calculate days difference
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // If same day (Today scenario)
    if (daysDiff === 1 && from.toDateString() === to.toDateString()) {
      // Generate 24 hourly data points
      for (let hour = 0; hour < 24; hour++) {
        let totalRevenue = 0;
        let totalSales = 0;
        let totalMargin = 0;

        selectedAccounts.forEach((accountName) => {
          const account = ACCOUNTS[accountName];
          if (account) {
            const activityMultiplier = hour >= 8 && hour <= 22 ? 1.5 : 0.3;
            const baseRevenue = (account.dailyRevenue[hour % account.dailyRevenue.length] || 200) / 24;
            const revenue = baseRevenue * activityMultiplier;
            
            totalRevenue += revenue;
            totalSales += Math.round(revenue / 25);
            totalMargin += revenue * (account.marginPercent / 100);
          }
        });

        data.push({
          date: `${hour.toString().padStart(2, "0")}:00`,
          revenue: Math.round(totalRevenue),
          sales: totalSales,
          netMargin: Math.round(totalMargin),
        });
      }
      return data;
    }
    
    // Daily points for the custom range
    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(from);
      date.setDate(date.getDate() + i);
      const dateStr = date.toLocaleDateString("fr-FR", { 
        month: "2-digit", 
        day: "2-digit" 
      });
      
      let totalRevenue = 0;
      let totalSales = 0;
      let totalMargin = 0;
      
      selectedAccounts.forEach((accountName) => {
        const account = ACCOUNTS[accountName];
        if (account) {
          const dayIndex = i % account.dailyRevenue.length;
          const revenue = account.dailyRevenue[dayIndex];
          totalRevenue += revenue;
          totalSales += Math.round(revenue / 25);
          totalMargin += revenue * (account.marginPercent / 100);
        }
      });
      
      data.push({
        date: dateStr,
        revenue: Math.round(totalRevenue),
        sales: totalSales,
        netMargin: Math.round(totalMargin),
      });
    }
    
    return data;
  }
  
  // For "today" and "yesterday", generate 24 hourly data points (midnight to midnight)
  if (dateRange === "today" || dateRange === "yesterday") {
    const data = [];
    const dayOffset = dateRange === "yesterday" ? 1 : 0;
    
    for (let hour = 0; hour < 24; hour++) {
      let totalRevenue = 0;
      let totalSales = 0;
      let totalMargin = 0;

      selectedAccounts.forEach((accountName) => {
        const account = ACCOUNTS[accountName];
        if (account) {
          // More activity during daytime hours (8am - 10pm)
          const activityMultiplier = hour >= 8 && hour <= 22 ? 1.5 : 0.3;
          const hourIndex = (hour + dayOffset * 24) % account.dailyRevenue.length;
          const baseRevenue = (account.dailyRevenue[hourIndex] || 200) / 24; // Divide daily into hourly
          // Add slight variation for yesterday
          const variation = dayOffset === 1 ? 0.95 : 1;
          const revenue = baseRevenue * activityMultiplier * variation;
          
          totalRevenue += revenue;
          totalSales += Math.round(revenue / 25); // Assume avg item price ~25€
          totalMargin += revenue * (account.marginPercent / 100);
        }
      });

      data.push({
        date: `${hour.toString().padStart(2, "0")}:00`,
        revenue: Math.round(totalRevenue),
        sales: totalSales,
        netMargin: Math.round(totalMargin),
      });
    }

    return data;
  }

  // For other date ranges, use daily data
  const days = dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : dateRange === "90days" ? 90 : 365;
  
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString("fr-FR", { 
      month: "2-digit", 
      day: "2-digit" 
    });
    
    let totalRevenue = 0;
    let totalSales = 0;
    let totalMargin = 0;
    
    selectedAccounts.forEach((accountName) => {
      const account = ACCOUNTS[accountName];
      if (account) {
        const dayIndex = (365 - days + (days - 1 - i)) % account.dailyRevenue.length;
        const revenue = account.dailyRevenue[dayIndex];
        totalRevenue += revenue;
        totalSales += Math.round(revenue / 25); // Assume avg item price ~25€
        totalMargin += revenue * (account.marginPercent / 100);
      }
    });
    
    data.push({
      date: dateStr,
      revenue: Math.round(totalRevenue),
      sales: totalSales,
      netMargin: Math.round(totalMargin),
    });
  }
  
  return data;
}

export function calculateKPIs(data: Array<{ revenue: number; sales: number; netMargin: number }>) {
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalSales = data.reduce((sum, d) => sum + d.sales, 0);
  const totalMargin = data.reduce((sum, d) => sum + d.netMargin, 0);
  const marginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  
  return {
    revenue: totalRevenue,
    sales: totalSales,
    marginPercent,
    netMargin: totalMargin,
  };
}

export function getAccountStats(
  accountName: string,
  dateRange: "today" | "yesterday" | "7days" | "30days" | "90days" | "ytd"
) {
  const data = generateMockData([accountName], dateRange);
  const kpis = calculateKPIs(data);
  
  return {
    sales: kpis.sales,
    revenue: kpis.revenue,
  };
}

export function calculateDelta(
  current: number,
  previous: number
): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function getPreviousPeriodData(
  selectedAccounts: string[],
  dateRange: "today" | "yesterday" | "7days" | "30days" | "90days" | "ytd",
  customFrom?: Date,
  customTo?: Date
) {
  // Handle custom date range
  if (customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate previous period with same length
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - daysDiff + 1);
    
    return generateMockData(selectedAccounts, dateRange, prevFrom, prevTo);
  }
  
  // Calculate previous period based on current range
  if (dateRange === "today") {
    return generateMockData(selectedAccounts, "yesterday");
  }
  
  if (dateRange === "yesterday") {
    // Day before yesterday
    const data = generateMockData(selectedAccounts, "today");
    // Adjust for previous day with 0.95 multiplier
    return data.map(d => ({
      ...d,
      revenue: Math.round(d.revenue * 0.90),
      sales: Math.round(d.sales * 0.90),
      netMargin: Math.round(d.netMargin * 0.90),
    }));
  }
  
  // For 7/30/90 days and YTD, generate equivalent previous period
  // Using a slight variation to simulate realistic comparison
  const data = generateMockData(selectedAccounts, dateRange);
  const variation = 0.92; // Previous period was slightly lower
  
  return data.map(d => ({
    ...d,
    revenue: Math.round(d.revenue * variation),
    sales: Math.round(d.sales * variation),
    netMargin: Math.round(d.netMargin * variation),
  }));
}
