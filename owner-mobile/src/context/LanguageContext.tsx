import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { safeStorage } from '../utils/safeStorage';

export type AppLanguage = 'en' | 'te' | 'hi' | 'ta' | 'kn';

export interface LanguageOption {
  code: AppLanguage;
  name: string;
  nativeName: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
];

const STORAGE_KEY = '@staynest_app_language';

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.rooms': 'Rooms',
    'nav.tenants': 'Tenants',
    'nav.wallet': 'Wallet',
    'nav.profile': 'Profile',

    'profile.title': 'Owner Profile',
    'profile.editProfile': 'Edit Profile',
    'profile.contactUs': 'CONTACT US',
    'profile.phoneSupport': '📞 Phone Support',
    'profile.emailSupport': '✉️ Email Support',
    'profile.languageSection': 'APP LANGUAGE',
    'profile.language': '🌐 Language',
    'profile.chooseLanguage': 'Choose App Language',
    'profile.syncBackend': 'Sync Live Backend Data (Clear Cache)',
    'profile.preferencesSub': 'App Preferences & Subscription',
    'profile.logout': 'Log Out',
    'profile.confirmLogoutTitle': 'Confirm Logout',
    'profile.confirmLogoutMsg': 'Are you sure you want to log out from StayNest?',
    'profile.cancel': 'Cancel',

    'home.addProperty': 'Add Property',
    'home.emptyBeds': 'Empty Beds',
    'home.occupiedBeds': 'Occupied Beds',
    'home.quickActions': 'Quick Actions',
    'home.addTenant': 'Add Tenant',
    'home.recordRent': 'Record Rent',
    'home.addExpense': 'Add Expense',
    'home.dueTenants': 'Due Tenants',
    'home.collectedRent': 'Collected',
    'home.pendingDue': 'Pending Due',

    'rooms.addFloor': '+ Add Floor',
    'rooms.allFloors': 'All Floors',
    'rooms.addRoom': 'Add Room',
    'rooms.addFlat': 'Add Flat',
    'rooms.builderMode': '✏️ Builder Mode',
    'rooms.saveChanges': '💾 Save Changes',
    'rooms.loading': 'Loading property structure...',

    'tenants.title': 'Tenant Management',
    'tenants.add': '+ Add',
    'tenants.searchPlaceholder': 'Search name, phone, room...',
    'tenants.all': 'All',
    'tenants.due': 'Due',
    'tenants.active': 'Active',
    'tenants.vacated': 'Vacated',

    'onboard.title': 'Onboard Resident',
    'onboard.subPg': 'Assign bed, fixed rent & rent cycle',
    'onboard.subRental': 'Assign flat, fixed rent & rent cycle',
    'onboard.fullName': '👤 RESIDENT FULL NAME *',
    'onboard.phone': '📱 PHONE NUMBER (10 DIGITS) *',
    'onboard.idProofType': '🪪 GOVERNMENT ID PROOF TYPE *',
    'onboard.fixedRent': 'Fixed Monthly Rent:',
    'onboard.fixedDeposit': 'Fixed Security Deposit:',
    'onboard.rentPayingNow': '💵 RENT AMOUNT PAYING NOW (₹) *',
    'onboard.depositPayingNow': '🛡️ SECURITY DEPOSIT PAYING NOW (₹) *',
    'onboard.paymentMode': '💳 INITIAL PAYMENT MODE',
    'onboard.dateOfJoining': '📅 DATE OF JOINING (CHECK-IN) *',
    'onboard.rentCycle': '🔄 MONTHLY RENT CYCLE (DUE DATE) *',
    'onboard.cancel': '← Cancel',
    'onboard.submitBed': '✓ Onboard & Assign Bed',
    'onboard.submitFlat': '✓ Onboard & Assign Flat',
    'onboard.submitting': 'Onboarding...',
  },

  te: {
    'nav.home': 'హోమ్',
    'nav.rooms': 'గదులు',
    'nav.tenants': 'అద్దెదారులు',
    'nav.wallet': 'వాలెట్',
    'nav.profile': 'ప్రొఫైల్',

    'profile.title': 'యజమాని ప్రొఫైల్',
    'profile.editProfile': 'ప్రొఫైల్ మార్చండి',
    'profile.contactUs': 'మమ్మల్ని సంప్రదించండి',
    'profile.phoneSupport': '📞 ఫోన్ సపోర్ట్',
    'profile.emailSupport': '✉️ ఈమెయిల్ సపోర్ట్',
    'profile.languageSection': 'యాప్ భాష',
    'profile.language': '🌐 భాష (Language)',
    'profile.chooseLanguage': 'యాప్ భాషను ఎంచుకోండి',
    'profile.syncBackend': 'లైవ్ డేటా సింక్ చేయండి (కాష్ క్లియర్)',
    'profile.preferencesSub': 'యాప్ సెట్టింగ్‌లు & సబ్‌స్క్రిప్షన్',
    'profile.logout': 'లాగ్ అవుట్',
    'profile.confirmLogoutTitle': 'లాగ్ అవుట్ నిర్ధారించండి',
    'profile.confirmLogoutMsg': 'మీరు StayNest నుండి లాగ్ అవుట్ చేయాలనుకుంటున్నారా?',
    'profile.cancel': 'రద్దు చేయండి',

    'home.addProperty': 'ప్రాపర్టీ జోడించండి',
    'home.emptyBeds': 'ఖాళీ బెడ్లు',
    'home.occupiedBeds': 'నిండిన బెడ్లు',
    'home.quickActions': 'త్వరిత చర్యలు',
    'home.addTenant': 'అద్దెదారుని జోడించండి',
    'home.recordRent': 'అద్దె నమోదు',
    'home.addExpense': 'ఖర్చు జోడించండి',
    'home.dueTenants': 'బాకీ ఉన్నవారు',
    'home.collectedRent': 'వసూలైనది',
    'home.pendingDue': 'బాకీ',

    'rooms.addFloor': '+ ఫ్లోర్ జోడించండి',
    'rooms.allFloors': 'అన్ని ఫ్లోర్లు',
    'rooms.addRoom': 'గది జోడించండి',
    'rooms.addFlat': 'ఫ్లాట్ జోడించండి',
    'rooms.builderMode': '✏️ బిల్డర్ మోడ్',
    'rooms.saveChanges': '💾 మార్పులు సేవ్ చేయండి',
    'rooms.loading': 'గదుల వివరాలు లోడ్ అవుతున్నాయి...',

    'tenants.title': 'అద్దెదారుల నిర్వహణ',
    'tenants.add': '+ జోడించండి',
    'tenants.searchPlaceholder': 'పేరు, ఫోన్, గది వెతకండి...',
    'tenants.all': 'అన్నీ',
    'tenants.due': 'బాకీ',
    'tenants.active': 'యాక్టివ్',
    'tenants.vacated': 'ఖాళీ చేసినవారు',

    'onboard.title': 'కొత్త అద్దెదారుని చేర్చండి',
    'onboard.subPg': 'బెడ్, స్థిర అద్దె & అద్దె తేదీని కేటాయించండి',
    'onboard.subRental': 'ఫ్లాట్, స్థిర అద్దె & అద్దె తేదీని కేటాయించండి',
    'onboard.fullName': '👤 అద్దెదారుని పూర్తి పేరు *',
    'onboard.phone': '📱 ఫోన్ నంబర్ (10 అంకెలు) *',
    'onboard.idProofType': '🪪 ప్రభుత్వ గుర్తింపు కార్డు రకం *',
    'onboard.fixedRent': 'స్థిర నెలవారీ అద్దె:',
    'onboard.fixedDeposit': 'స్థిర సెక్యూరిటీ డిపాజిట్:',
    'onboard.rentPayingNow': '💵 ఇప్పుడు చెల్లిస్తున్న అద్దె (₹) *',
    'onboard.depositPayingNow': '🛡️ ఇప్పుడు చెల్లిస్తున్న డిపాజిట్ (₹) *',
    'onboard.paymentMode': '💳 చెల్లింపు విధానం',
    'onboard.dateOfJoining': '📅 చేరిన తేదీ (చెక్-ఇన్) *',
    'onboard.rentCycle': '🔄 నెలవారీ అద్దె తేదీ *',
    'onboard.cancel': '← రద్దు',
    'onboard.submitBed': '✓ చేర్చండి & బెడ్ కేటాయించండి',
    'onboard.submitFlat': '✓ చేర్చండి & ఫ్లాట్ కేటాయించండి',
    'onboard.submitting': 'సేవ్ అవుతోంది...',
  },

  hi: {
    'nav.home': 'होम',
    'nav.rooms': 'कमरे',
    'nav.tenants': 'किरायेदार',
    'nav.wallet': 'वॉलेट',
    'nav.profile': 'प्रोफ़ाइल',

    'profile.title': 'मालिक प्रोफ़ाइल',
    'profile.editProfile': 'प्रोफ़ाइल संपादित करें',
    'profile.contactUs': 'संपर्क करें',
    'profile.phoneSupport': '📞 फ़ोन सहायता',
    'profile.emailSupport': '✉️ ईमेल सहायता',
    'profile.languageSection': 'ऐप की भाषा',
    'profile.language': '🌐 भाषा (Language)',
    'profile.chooseLanguage': 'ऐप की भाषा चुनें',
    'profile.syncBackend': 'लाइव डेटा सिंक करें (कैश साफ़ करें)',
    'profile.preferencesSub': 'ऐप प्राथमिकताएं और सब्सक्रिप्शन',
    'profile.logout': 'लॉग आउट',
    'profile.confirmLogoutTitle': 'लॉग आउट की पुष्टि करें',
    'profile.confirmLogoutMsg': 'क्या आप वाकई StayNest से लॉग आउट करना चाहते हैं?',
    'profile.cancel': 'रद्द करें',

    'home.addProperty': 'प्रॉपर्टी जोड़ें',
    'home.emptyBeds': 'खाली बेड',
    'home.occupiedBeds': 'भरे हुए बेड',
    'home.quickActions': 'त्वरित कार्य',
    'home.addTenant': 'किरायेदार जोड़ें',
    'home.recordRent': 'किराया दर्ज करें',
    'home.addExpense': 'खर्च जोड़ें',
    'home.dueTenants': 'बकाया किरायेदार',
    'home.collectedRent': 'वसूल किया गया',
    'home.pendingDue': 'बकाया राशि',

    'rooms.addFloor': '+ मंज़िल जोड़ें',
    'rooms.allFloors': 'सभी मंज़िलें',
    'rooms.addRoom': 'कमरा जोड़ें',
    'rooms.addFlat': 'फ़्लैट जोड़ें',
    'rooms.builderMode': '✏️ बिल्डर मोड',
    'rooms.saveChanges': '💾 बदलाव सहेजें',
    'rooms.loading': 'प्रॉपर्टी संरचना लोड हो रही है...',

    'tenants.title': 'किरायेदार प्रबंधन',
    'tenants.add': '+ जोड़ें',
    'tenants.searchPlaceholder': 'नाम, फ़ोन, कमरा खोजें...',
    'tenants.all': 'सभी',
    'tenants.due': 'बकाया',
    'tenants.active': 'सक्रिय',
    'tenants.vacated': 'खाली किया',

    'onboard.title': 'नया किरायेदार जोड़ें',
    'onboard.subPg': 'बेड, निश्चित किराया और किराया चक्र चुनें',
    'onboard.subRental': 'फ़्लैट, निश्चित किराया और किराया चक्र चुनें',
    'onboard.fullName': '👤 किरायेदार का पूरा नाम *',
    'onboard.phone': '📱 फ़ोन नंबर (10 अंक) *',
    'onboard.idProofType': '🪪 सरकारी पहचान पत्र प्रकार *',
    'onboard.fixedRent': 'निश्चित मासिक किराया:',
    'onboard.fixedDeposit': 'निश्चित सुरक्षा जमा:',
    'onboard.rentPayingNow': '💵 अभी दिया जाने वाला किराया (₹) *',
    'onboard.depositPayingNow': '🛡️ अभी दी जाने वाली जमा राशि (₹) *',
    'onboard.paymentMode': '💳 भुगतान का तरीका',
    'onboard.dateOfJoining': '📅 शामिल होने की तिथि *',
    'onboard.rentCycle': '🔄 मासिक किराया चक्र (देय तिथि) *',
    'onboard.cancel': '← रद्द करें',
    'onboard.submitBed': '✓ जोड़ें और बेड दें',
    'onboard.submitFlat': '✓ जोड़ें और फ़्लैट दें',
    'onboard.submitting': 'सहेजा जा रहा है...',
  },

  ta: {
    'nav.home': 'முகப்பு',
    'nav.rooms': 'அறைகள்',
    'nav.tenants': 'குடியிருப்போர்',
    'nav.wallet': 'வாலட்',
    'nav.profile': 'சுயவிவரம்',

    'profile.title': 'உரிமையாளர் சுயவிவரம்',
    'profile.editProfile': 'சுயவிவரத்தை திருத்து',
    'profile.contactUs': 'எங்களை தொடர்பு கொள்ள',
    'profile.phoneSupport': '📞 தொலைபேசி உதவி',
    'profile.emailSupport': '✉️ மின்னஞ்சல் உதவி',
    'profile.languageSection': 'செயலி மொழி',
    'profile.language': '🌐 மொழி (Language)',
    'profile.chooseLanguage': 'செயலி மொழியைத் தேர்ந்தெடுக்கவும்',
    'profile.syncBackend': 'நேரடி தரவை ஒத்திசைக்கவும்',
    'profile.preferencesSub': 'விருப்பங்கள் & சந்தா',
    'profile.logout': 'வெளியேறு',
    'profile.confirmLogoutTitle': 'வெளியேறுவதை உறுதிப்படுத்தவும்',
    'profile.confirmLogoutMsg': 'StayNest இலிருந்து வெளியேற விரும்புகிறீர்களா?',
    'profile.cancel': 'ரத்து செய்',

    'home.addProperty': 'சொத்து சேர்க்க',
    'home.emptyBeds': 'காலி படுக்கைகள்',
    'home.occupiedBeds': 'நிரம்பிய படுக்கைகள்',
    'home.quickActions': 'விரைவு செயல்கள்',
    'home.addTenant': 'குடியிருப்போர் சேர்க்க',
    'home.recordRent': 'வாடகை பதிவு',
    'home.addExpense': 'செலவு சேர்க்க',
    'home.dueTenants': 'நிலுவை உள்ளோர்',
    'home.collectedRent': 'வசூலானது',
    'home.pendingDue': 'நிலுவை',

    'rooms.addFloor': '+ தளம் சேர்க்க',
    'rooms.allFloors': 'அனைத்து தளங்கள்',
    'rooms.addRoom': 'அறை சேர்க்க',
    'rooms.addFlat': 'பிளாட் சேர்க்க',
    'rooms.builderMode': '✏️ பில்டர் பயன்முறை',
    'rooms.saveChanges': '💾 மாற்றங்களை சேமி',
    'rooms.loading': 'அறை விவரங்கள் ஏற்றப்படுகின்றன...',

    'tenants.title': 'குடியிருப்போர் மேலாண்மை',
    'tenants.add': '+ சேர்க்க',
    'tenants.searchPlaceholder': 'பெயர், போன், அறை தேடுங்கள்...',
    'tenants.all': 'அனைத்தும்',
    'tenants.due': 'நிலுவை',
    'tenants.active': 'செயலில்',
    'tenants.vacated': 'காலி செய்தோர்',

    'onboard.title': 'புதிய குடியிருப்போர் சேர்க்க',
    'onboard.subPg': 'படுக்கை, நிலையான வாடகை & தேதி ஒதுக்கவும்',
    'onboard.subRental': 'பிளாட், நிலையான வாடகை & தேதி ஒதுக்கவும்',
    'onboard.fullName': '👤 முழு பெயர் *',
    'onboard.phone': '📱 தொலைபேசி எண் (10 இலக்கங்கள்) *',
    'onboard.idProofType': '🪪 அரசு அடையாள அட்டை வகை *',
    'onboard.fixedRent': 'நிலையான மாத வாடகை:',
    'onboard.fixedDeposit': 'நிலையான பாதுகாப்பு வைப்பு:',
    'onboard.rentPayingNow': '💵 இப்போது செலுத்தும் வாடகை (₹) *',
    'onboard.depositPayingNow': '🛡️ இப்போது செலுத்தும் வைப்பு (₹) *',
    'onboard.paymentMode': '💳 கட்டண முறை',
    'onboard.dateOfJoining': '📅 சேரும் தேதி *',
    'onboard.rentCycle': '🔄 மாதாந்திர வாடகை சுழற்சி *',
    'onboard.cancel': '← ரத்து',
    'onboard.submitBed': '✓ சேர்க்க & படுக்கை ஒதுக்க',
    'onboard.submitFlat': '✓ சேர்க்க & பிளாட் ஒதுக்க',
    'onboard.submitting': 'சேமிக்கப்படுகிறது...',
  },

  kn: {
    'nav.home': 'ಹೋಮ್',
    'nav.rooms': 'ಕೊಠಡಿಗಳು',
    'nav.tenants': 'ಬಾಡಿಗೆದಾರರು',
    'nav.wallet': 'ವಾಲೆಟ್',
    'nav.profile': 'ಪ್ರೊಫೈಲ್',

    'profile.title': 'ಮಾಲೀಕರ ಪ್ರೊಫೈಲ್',
    'profile.editProfile': 'ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ',
    'profile.contactUs': 'ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ',
    'profile.phoneSupport': '📞 ಫೋನ್ ಬೆಂಬಲ',
    'profile.emailSupport': '✉️ ಇಮೇಲ್ ಬೆಂಬಲ',
    'profile.languageSection': 'ಆ್ಯಪ್ ಭಾಷೆ',
    'profile.language': '🌐 ಭಾಷೆ (Language)',
    'profile.chooseLanguage': 'ಆ್ಯಪ್ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    'profile.syncBackend': 'ಲೈವ್ ಡೇಟಾ ಸಿಂಕ್ ಮಾಡಿ',
    'profile.preferencesSub': 'ಆ್ಯಪ್ ಆದ್ಯತೆಗಳು ಮತ್ತು ಚಂದಾದಾರಿಕೆ',
    'profile.logout': 'ಲಾಗ್ ಔಟ್',
    'profile.confirmLogoutTitle': 'ಲಾಗ್ ಔಟ್ ದೃಢೀಕರಿಸಿ',
    'profile.confirmLogoutMsg': 'ನೀವು StayNest ನಿಂದ ಲಾಗ್ ಔಟ್ ಮಾಡಲು ಖಚಿತವಾಗಿ ಬಯಸುವಿರಾ?',
    'profile.cancel': 'ರದ್ದುಮಾಡಿ',

    'home.addProperty': 'ಪ್ರಾಪರ್ಟಿ ಸೇರಿಸಿ',
    'home.emptyBeds': 'ಖಾಲಿ ಬೆಡ್‌ಗಳು',
    'home.occupiedBeds': 'ತುಂಬಿದ ಬೆಡ್‌ಗಳು',
    'home.quickActions': 'ತ್ವರಿತ ಕ್ರಿಯೆಗಳು',
    'home.addTenant': 'ಬಾಡಿಗೆದಾರರನ್ನು ಸೇರಿಸಿ',
    'home.recordRent': 'ಬಾಡಿಗೆ ದಾಖಲಿಸಿ',
    'home.addExpense': 'ವೆಚ್ಚ ಸೇರಿಸಿ',
    'home.dueTenants': 'ಬಾಕಿ ಇರುವವರು',
    'home.collectedRent': 'ಸಂಗ್ರಹಿಸಿದ ಬಾಡಿಗೆ',
    'home.pendingDue': 'ಬಾಕಿ ಮೊತ್ತ',

    'rooms.addFloor': '+ ಮಹಡಿ ಸೇರಿಸಿ',
    'rooms.allFloors': 'ಎಲ್ಲಾ ಮಹಡಿಗಳು',
    'rooms.addRoom': 'ಕೊಠಡಿ ಸೇರಿಸಿ',
    'rooms.addFlat': 'ಫ್ಲಾಟ್ ಸೇರಿಸಿ',
    'rooms.builderMode': '✏️ ಬಿಲ್ಡರ್ ಮೋಡ್',
    'rooms.saveChanges': '💾 ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
    'rooms.loading': 'ಕೊಠಡಿ ವಿವರಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...',

    'tenants.title': 'ಬಾಡಿಗೆದಾರರ ನಿರ್ವಹಣೆ',
    'tenants.add': '+ ಸೇರಿಸಿ',
    'tenants.searchPlaceholder': 'ಹೆಸರು, ಫೋನ್, ಕೊಠಡಿ ಹುಡುಕಿ...',
    'tenants.all': 'ಎಲ್ಲಾ',
    'tenants.due': 'ಬಾಕಿ',
    'tenants.active': 'ಸಕ್ರಿಯ',
    'tenants.vacated': 'ಖಾಲಿ ಮಾಡಿದವರು',

    'onboard.title': 'ಹೊಸ ಬಾಡಿಗೆದಾರರನ್ನು ಸೇರಿಸಿ',
    'onboard.subPg': 'ಬೆಡ್, ನಿಗದಿತ ಬಾಡಿಗೆ ಮತ್ತು ದಿನಾಂಕ ನಿಯೋಜಿಸಿ',
    'onboard.subRental': 'ಫ್ಲಾಟ್, ನಿಗದಿತ ಬಾಡಿಗೆ ಮತ್ತು ದಿನಾಂಕ ನಿಯೋಜಿಸಿ',
    'onboard.fullName': '👤 ಪೂರ್ಣ ಹೆಸರು *',
    'onboard.phone': '📱 ಫೋನ್ ಸಂಖ್ಯೆ (10 ಅಂಕಿಗಳು) *',
    'onboard.idProofType': '🪪 ಸರ್ಕಾರಿ ಗುರುತಿನ ಚೀಟಿ ಪ್ರಕಾರ *',
    'onboard.fixedRent': 'ನಿಗದಿತ ಮಾಸಿಕ ಬಾಡಿಗೆ:',
    'onboard.fixedDeposit': 'ನಿಗದಿತ ಭದ್ರತಾ ಠೇವಣಿ:',
    'onboard.rentPayingNow': '💵 ಈಗ ಪಾವತಿಸುವ ಬಾಡಿಗೆ (₹) *',
    'onboard.depositPayingNow': '🛡️ ಈಗ ಪಾವತಿಸುವ ಠೇವಣಿ (₹) *',
    'onboard.paymentMode': '💳 ಪಾವತಿ ವಿಧಾನ',
    'onboard.dateOfJoining': '📅 ಸೇರುವ ದಿನಾಂಕ *',
    'onboard.rentCycle': '🔄 ಮಾಸಿಕ ಬಾಡಿಗೆ ಚಕ್ರ *',
    'onboard.cancel': '← ರದ್ದು',
    'onboard.submitBed': '✓ ಸೇರಿಸಿ ಮತ್ತು ಬೆಡ್ ನೀಡಿ',
    'onboard.submitFlat': '✓ ಸೇರಿಸಿ ಮತ್ತು ಫ್ಲಾಟ್ ನೀಡಿ',
    'onboard.submitting': 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...',
  },
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: string) => string;
  languageOptions: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => TRANSLATIONS.en[key] || key,
  languageOptions: LANGUAGE_OPTIONS,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        let saved = await safeStorage.getItem(STORAGE_KEY);
        if (!saved && Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          saved = window.localStorage.getItem('staynest_app_language');
        }
        if (saved && ['en', 'te', 'hi', 'ta', 'kn'].includes(saved)) {
          setLanguageState(saved as AppLanguage);
        }
      } catch {
        // ignore
      }
    };
    void loadSavedLanguage();
  }, []);

  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      await safeStorage.setItem(STORAGE_KEY, lang);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_app_language', lang);
      }
    } catch {
      // ignore
    }
  };

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageOptions: LANGUAGE_OPTIONS }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
