const { v4: uuidv4 } = require('uuid');

const generateApplicationNo = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `APP${year}${month}${day}${random}`;
};

const generateCertificateNo = () => {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `CERT${year}${random}`;
};

const generateReportNo = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RPT${year}${month}${random}`;
};

const generateVerificationCode = () => {
  return uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
};

const addHours = (date, hours) => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

const addDays = (date, days) => {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
};

const diffHours = (date1, date2) => {
  return Math.abs(date1 - date2) / (1000 * 60 * 60);
};

const diffDays = (date1, date2) => {
  return Math.ceil(Math.abs(date1 - date2) / (1000 * 60 * 60 * 24));
};

const getMonthRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const errorResponse = (res, message, statusCode = 400, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  });
};

const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

const paginate = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const perPage = parseInt(limit) || 10;
  const totalPages = Math.ceil(total / perPage);
  const skip = (currentPage - 1) * perPage;
  
  return {
    currentPage,
    perPage,
    totalPages,
    total,
    skip,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
};

const maskIdCard = (idCard) => {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.substring(0, 6) + '*'.repeat(idCard.length - 10) + idCard.substring(idCard.length - 4);
};

const maskPhone = (phone) => {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 3) + '*'.repeat(phone.length - 7) + phone.substring(phone.length - 4);
};

module.exports = {
  generateApplicationNo,
  generateCertificateNo,
  generateReportNo,
  generateVerificationCode,
  addHours,
  addDays,
  diffHours,
  diffDays,
  getMonthRange,
  asyncHandler,
  errorResponse,
  successResponse,
  paginate,
  maskIdCard,
  maskPhone
};
