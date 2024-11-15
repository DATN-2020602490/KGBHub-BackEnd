import { CoursesPaid, Order, ReportData } from '../../global';

export const groupOrdersByDate = (orders: any[], groupBy: string, isSystem = true) => {
  const result = orders.reduce((acc: ReportData, order) => {
    const dateKey = getDateKey(order.updatedAt, groupBy);
    if (!acc[dateKey]) {
      acc[dateKey] = { totalOriginalAmount: 0, totalAmount: 0, totalOrder: 0 };
      if (isSystem) {
        acc[dateKey]['totalFee'] = 0;
        acc[dateKey]['totalTip'] = 0;
      }
    }
    acc[dateKey].totalOrder += 1;
    acc[dateKey].totalOriginalAmount += order.originalAmount;
    acc[dateKey].totalAmount += order.amount;
    if (isSystem) {
      acc[dateKey].totalFee += order.platformFee;
      acc[dateKey].totalTip += order.KGBHubServiceTip;
    }
    return acc;
  }, {});

  const sortedData = Object.fromEntries(
    Object.entries(result).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)),
  ) as ReportData;
  return sortedData;
};

export const getDateKey = (date: Date, groupBy) => {
  const isoDate = date.toISOString().split('T')[0];
  if (groupBy === 'day') {
    return isoDate;
  }
  if (groupBy === 'month') {
    return isoDate.slice(0, 7);
  }
  if (groupBy === 'year') {
    return isoDate.slice(0, 4);
  }
  return null;
};

export const processOrdersReportAuthor = (coursesPaids: CoursesPaid[], groupBy: string) => {
  const orders = [] as Order[];
  for (const coursePaid of coursesPaids) {
    const order = {
      updatedAt: coursePaid.order.updatedAt,
    } as Order;
    const salePrice = findX(coursePaid.course.priceAmount, coursePaid.order.originalAmount, coursePaid.order.amount);
    order.amount = salePrice;
    order.originalAmount = coursePaid.course.priceAmount;
    orders.push(order);
  }
  return groupOrdersByDate(orders, groupBy, false);
};

function findX(a, b, y) {
  if (b === 0) {
    throw new Error('Division by zero: b cannot be zero.');
  }
  return (a * y) / b;
}
