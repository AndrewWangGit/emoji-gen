// API Configuration for different environments
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3001'
  },
  production: {
    API_BASE_URL: '' // Empty string uses same origin in production
  }
};

const environment = process.env.NODE_ENV || 'development';
const currentConfig = config[environment as keyof typeof config];

export const API_BASE_URL = currentConfig.API_BASE_URL;
export default currentConfig;