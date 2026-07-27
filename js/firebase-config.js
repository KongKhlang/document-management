const firebaseConfig = {
  apiKey: "AIzaSyC1egDA5LVjHekFCF544rfBQDOHDY2X6Ok",
  authDomain: "document-management-2f76d.firebaseapp.com",
  projectId: "document-management-2f76d",
  storageBucket: "document-management-2f76d.firebasestorage.app",
  messagingSenderId: "327686159059",
  appId: "1:327686159059:web:3554313ff2d90c18407226",
  measurementId: "G-X9XVHQEE5V"
};

const GOOGLE_CLIENT_ID = '327686159059-e8sp3b64365g2n3ggkcb48rtis3h1asi.apps.googleusercontent.com';
const GOOGLE_API_KEY = firebaseConfig.apiKey;
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_ID = '1dqrlfEofScWRlfny4tRf9faT0-0y1Ek-';
const FIRST_ADMIN_EMAIL = 'charun.work99@gmail.com';

firebase.initializeApp(firebaseConfig);

window.DMS = {
  db: firebase.firestore(),
  auth: firebase.auth(),
  currentUser: null,
  currentPage: 'dashboard',
  cache: {},
  currentTopicId: null,
  editingTopicId: null,
  editingCategoryId: null,
  pendingFiles: [],
  driveReady: false,
  googleAccessToken: null
};

// Google API initialization is handled via fetch with tokens
// but if gapi is needed later, it can be initialized here.
