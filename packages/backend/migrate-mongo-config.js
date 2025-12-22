/**
 * migrate-mongo configuration
 * 
 * This file configures migrate-mongo to work with your MongoDB connection.
 * It uses the same configuration as your main application.
 * 
 * Note: This config is loaded synchronously, so it uses environment variables
 * directly rather than the full config system (which may be async).
 */

module.exports = {
  mongodb: {
    // Use MONGODB_URL from environment, or default to local development
    url: process.env.MONGODB_URL || 'mongodb://localhost:27017/bianca-app',
    
    // Connection options
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  
  // Directory where migration files are stored
  migrationsDir: 'migrations',
  
  // Collection name to store migration history
  changelogCollectionName: 'migrations',
  
  // Migration file extension
  migrationFileExtension: '.js',
  
  // Whether to use the file name as the migration name
  useFileHash: false,
};

