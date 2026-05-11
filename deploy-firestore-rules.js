const fs = require('fs');
const path = require('path');

// Read the firestore rules file
const rulesPath = path.join(__dirname, 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

console.log('Firestore Rules Content:');
console.log('======================');
console.log(rulesContent);
console.log('======================');
console.log('\nTo deploy these rules, you have two options:');
console.log('\n1. MANUAL DEPLOYMENT (Recommended):');
console.log('   - Go to Firebase Console: https://console.firebase.google.com/');
console.log('   - Select your project: gen-lang-client-0126285169');
console.log('   - Go to Firestore Database → Rules tab');
console.log('   - Copy and paste the rules content above');
console.log('   - Click "Publish"');
console.log('\n2. AUTOMATIC DEPLOYMENT (requires Firebase CLI):');
console.log('   - Install Node.js and npm');
console.log('   - Run: npm install -g firebase-tools');
console.log('   - Run: firebase login');
console.log('   - Run: firebase deploy --only firestore:rules');

// Also create a copy of the rules for easy access
const outputPath = path.join(__dirname, 'firestore-rules-for-deployment.txt');
fs.writeFileSync(outputPath, rulesContent);
console.log(`\nRules also saved to: ${outputPath}`);
