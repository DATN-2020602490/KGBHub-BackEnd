export const generateRandomString = (length = 5) => {
  const chars = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const calculateStripeWithFee = (price: number) => {
  return parseFloat((price * 1.043 + 0.3).toFixed(2));
};

export const removeFeeFromPrice = (price: number) => {
  return parseFloat(((price - 0.3) / 1.043).toFixed(2));
};

export const toStripePrice = (price: number) => {
  return Math.floor(Math.round(price * 1000) / 10).toString();
};
