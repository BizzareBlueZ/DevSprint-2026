import React, { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

const translations = {
    en: {
        // Common
        loading: 'Loading...',
        cancel: 'Cancel',
        submit: 'Submit',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        confirm: 'Confirm',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        page: 'Page',
        email: 'Email',
        password: 'Password',
        enterPassword: 'Enter your password',
        welcomeBack: 'Welcome back',
        
        // Navigation
        home: 'Home',
        apps: 'Apps',
        account: 'Account',
        orders: 'Orders',
        wallet: 'Wallet',
        settings: 'Settings',
        logout: 'Logout',
        
        // Order History
        orderHistory: 'Order History',
        searchItems: 'Search items...',
        allStatuses: 'All Statuses',
        noOrders: 'No orders found',
        amount: 'Amount',
        date: 'Date',
        scheduledPickup: 'Scheduled Pickup',
        
        // Order Status
        pending: 'Pending',
        verified: 'Verified',
        preparing: 'Preparing',
        ready: 'Ready',
        pickedUp: 'Picked Up',
        completed: 'Completed',
        failed: 'Failed',
        
        // Reviews
        writeReview: 'Write Review',
        reviewOrder: 'Review Order',
        rating: 'Rating',
        comment: 'Comment (optional)',
        shareExperience: 'Share your experience...',
        submitReview: 'Submit Review',
        submitting: 'Submitting...',
        avgRating: 'Average Rating',
        reviews: 'Reviews',
        noReviews: 'No reviews yet',
        
        // QR Code
        showQR: 'Show QR',
        qrPickup: 'QR Code for Pickup',
        scanAtCounter: 'Scan this code at the counter',
        yourQRCode: 'Your QR Code',
        showAtCounter: 'Show this QR code at the cafeteria counter',
        trackOrder: 'Track Order',
        close: 'Close',
        
        // Cafeteria
        cafeteria: 'Cafeteria',
        menu: 'Menu',
        addToCart: 'Add to Cart',
        outOfStock: 'Out of Stock',
        orderNow: 'Order Now',
        scheduleOrder: 'Schedule Order',
        selectPickupTime: 'Select Pickup Time',
        pickupTime: 'Pickup Time',
        
        // Wallet
        balance: 'Balance',
        addFunds: 'Add Funds',
        transactions: 'Transactions',
        
        // Auth
        login: 'Login',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        studentId: 'Student ID',
        name: 'Name',
        department: 'Department',
        notifications: 'Notifications',
        enableNotifications: 'Enable Notifications',
        notificationsEnabled: 'Notifications Enabled',
        orderReady: 'Your order is ready for pickup!',
        notificationsBlocked: 'Blocked by browser — enable in settings',
        notificationsActive: 'You will be notified when your order is ready',
        pushGetNotified: 'Get notified when your food is ready for pickup',
        
        // Language
        language: 'Language',
        english: 'English',
        bangla: 'বাংলা',
        
        // Messages
        orderPlaced: 'Order placed successfully!',
        reviewSubmitted: 'Review submitted!',
        error: 'Something went wrong',
        insufficientBalance: 'Insufficient balance',

        // Password
        passwordMinimum: 'Password must be at least 6 characters',
        passwordLetter: 'Password must contain a letter',
        passwordDigit: 'Password must contain a digit',
        passwordSpecial: 'Password must contain a special character',
        passwordStrength: 'Password Strength',
        
        // Wallet & Payment
        wallet: 'Wallet',
        addMoney: 'Add Money',
        topupFailed: 'Top-up failed. Please try again.',
        minTopup: 'Minimum top-up is ৳10',
        phoneRequired: 'Please enter your mobile number',
        validPhone: 'Please enter a valid phone number',
        selectPaymentMethod: 'Please select a payment method',
        confirmTopup: 'Confirm Top-up',
        totalCredited: 'Total Credited',
        totalSpent: 'Total Spent',
        transactionHistory: 'Transaction History',
        noTransactions: 'No transactions yet',
        
        // Emergency Balance
        emergencyBalance: 'Emergency Balance',
        emergencyDesc: 'Take an advance from your IUT monthly allowance. This amount will be automatically deducted from your next bank allowance.',
        emergencyLimit: 'Limit',
        emergencyOutstanding: 'Outstanding',
        emergencyAvailable: 'Available',
        emergencyReason: 'Reason (optional)',
        emergencyReasonPlaceholder: 'e.g. Need lunch money urgently',
        emergencyTake: 'Take',
        emergencyNote: '⚠️ This amount will be deducted from your next IUT monthly allowance.',
        emergencySuccess: 'Emergency balance added!',
        minEmergency: 'Minimum ৳10',
        maxEmergency: 'Maximum available',

        // Cafeteria & Food
        specialMenu: 'Special Menu',
        restaurantInfo: 'Restaurant Information',
        openingHours: 'Opening Hours',
        closed: 'Closed',
        todaySpecial: 'Today\'s Special',
        description: 'Description',
        addCart: 'Add to Cart',
        price: 'Price',
        category: 'Category',
        
        // Login/Register
        createAccount: 'Create Account',
        registerWithIUT: 'Register with your IUT student ID',
        signIn: 'Sign in',
        forgotPassword: 'Forgot password?',
        alreadyHave: 'Already have an account?',
        dontHave: 'Don\'t have an account?',
        year: 'Year',
        alreadyExists: 'A student with this email or ID already exists',
        registrationSuccess: 'Registration successful',
        loginSuccess: 'Welcome back!',
        invalidCredentials: 'Invalid email or password',
        
        // Account
        accountDetails: 'Account Details',
        fullName: 'Full Name',
        removePhoto: 'Remove Photo',
        changePhoto: 'Change photo',
        signOut: 'Sign Out',
        profile: 'Profile',
        
        // Admin
        analytics: 'Analytics',
        adminMenu: 'Admin Menu',
        menuManagement: 'Menu Management',
        addMenuItem: 'Add Menu Item',
        editMenuItem: 'Edit Menu Item',
        deleteMenuItem: 'Delete Menu Item',
        stockManagement: 'Stock Management',
        userManagement: 'User Management',
        
        // Status & Filters
        all: 'All',
        active: 'Active',
        inactive: 'Inactive',
        search: 'Search',
        filter: 'Filter',
        sort: 'Sort',
        duration: 'Duration',
        
        // Common Actions
        proceed: 'Proceed',
        confirm: 'Confirm',
        cancel: 'Cancel',
        apply: 'Apply',
        reset: 'Reset',
        retry: 'Retry',
        success: 'Success',
    },
    bn: {
        // Common
        loading: 'লোড হচ্ছে...',
        cancel: 'বাতিল করুন',
        submit: 'জমা দিন',
        save: 'সংরক্ষণ করুন',
        delete: 'মুছুন',
        edit: 'সম্পাদনা করুন',
        confirm: 'নিশ্চিত করুন',
        close: 'বন্ধ করুন',
        back: 'পিছিয়ে যান',
        next: 'পরবর্তী',
        previous: 'পূর্ববর্তী',
        page: 'পৃষ্ঠা',
        email: 'ইমেইল',
        password: 'পাসওয়ার্ড',
        enterPassword: 'আপনার পাসওয়ার্ড লিখুন',
        welcomeBack: 'আপনাকে স্বাগতম',
        
        // Navigation
        home: 'হোম',
        apps: 'অ্যাপস',
        account: 'অ্যাকাউন্ট',
        orders: 'অর্ডার',
        wallet: 'ওয়ালেট',
        settings: 'সেটিংস',
        logout: 'লগআউট',
        
        // Order History
        orderHistory: 'অর্ডার ইতিহাস',
        searchItems: 'আইটেম খুঁজুন...',
        allStatuses: 'সমস্ত স্ট্যাটাস',
        noOrders: 'কোন অর্ডার পাওয়া যায়নি',
        amount: 'পরিমাণ',
        date: 'তারিখ',
        scheduledPickup: 'নির্ধারিত পিকআপ',
        
        // Order Status
        pending: 'অপেক্ষমান',
        verified: 'যাচাই করা',
        preparing: 'প্রস্তুত করা',
        ready: 'প্রস্তুত',
        pickedUp: 'উঠিয়ে নেওয়া',
        completed: 'সম্পূর্ণ',
        failed: 'ব্যর্থ',
        
        // Reviews
        writeReview: 'রিভিউ লিখুন',
        reviewOrder: 'অর্ডার রিভিউ করুন',
        rating: 'রেটিং',
        comment: 'মন্তব্য',
        submitReview: 'রিভিউ জমা দিন',
        
        // Notifications
        notifications: 'বিজ্ঞপ্তি',
        enableNotifications: 'বিজ্ঞপ্তি সক্ষম করুন',
        notificationsEnabled: 'বিজ্ঞপ্তি সক্ষম',
        orderReady: 'আপনার অর্ডার পিকআপের জন্য প্রস্তুত!',
        notificationsBlocked: 'ব্রাউজার ব্লক করেছে — সেটিংস থেকে চালু করুন',
        notificationsActive: 'আপনার অর্ডার প্রস্তুত হলে আপনাকে জানানো হবে',
        pushGetNotified: 'আপনার খাবার পিকআপের জন্য প্রস্তুত হলে জানুন',
        
        // Language
        language: 'ভাষা',
        english: 'English',
        bangla: 'বাংলা',
        
        // Messages
        orderPlaced: 'অর্ডার সফলভাবে দেওয়া হয়েছে!',
        reviewSubmitted: 'রিভিউ জমা দেওয়া হয়েছে!',
        error: 'কিছু ভুল হয়েছে',
        insufficientBalance: 'অপর্যাপ্ত ব্যালেন্স',

        // Password
        passwordMinimum: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে',
        passwordLetter: 'পাসওয়ার্ডে একটি অক্ষর থাকতে হবে',
        passwordDigit: 'পাসওয়ার্ডে একটি সংখ্যা থাকতে হবে',
        passwordSpecial: 'পাসওয়ার্ডে একটি বিশেষ চিহ্ন থাকতে হবে',
        passwordStrength: 'পাসওয়ার্ড শক্তি',
        
        // Wallet & Payment
        wallet: 'ওয়ালেট',
        addMoney: 'টাকা যোগ করুন',
        topupFailed: 'টপআপ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।',
        minTopup: 'ন্যূনতম টপআপ ৳১০ তাকা',
        phoneRequired: 'অনুগ্রহ করে আপনার মোবাইল নম্বর লিখুন',
        validPhone: 'অনুগ্রহ করে একটি বৈধ ফোন নম্বর লিখুন',
        selectPaymentMethod: 'অনুগ্রহ করে পেমেন্ট পদ্ধতি নির্বাচন করুন',
        confirmTopup: 'টপআপ নিশ্চিত করুন',
        totalCredited: 'মোট জমা পড়েছে',
        totalSpent: 'মোট খরচ',
        transactionHistory: 'লেনদেন ইতিহাস',
        noTransactions: 'এখনও কোন লেনদেন নেই',
        
        // Emergency Balance
        emergencyBalance: 'জরুরী ব্যালেন্স',
        emergencyDesc: 'আপনার আইইউটি মাসিক ভাতা থেকে অগ্রিম নিন। এই পরিমাণ আপনার পরবর্তী ব্যাংক ভাতা থেকে স্বয়ংক্রিয়ভাবে কাটা হবে।',
        emergencyLimit: 'সীমা',
        emergencyOutstanding: 'বকেয়া',
        emergencyAvailable: 'উপলব্ধ',
        emergencyReason: 'কারণ (ঐচ্ছিক)',
        emergencyReasonPlaceholder: 'যেমন জরুরী ভাবে খাবারের টাকা লাগবে',
        emergencyTake: 'নিন',
        emergencyNote: '⚠️ এই পরিমাণ আপনার পরবর্তী আইইউটি মাসিক ভাতা থেকে কাটা হবে।',
        emergencySuccess: 'জরুরি ব্যালেন্স যুক্ত হয়েছে!',
        minEmergency: 'ন্যূনতম ৳১০',
        maxEmergency: 'সর্বাধিক উপলব্ধ',

        // Cafeteria & Food
        specialMenu: 'বিশেষ মেনু',
        restaurantInfo: 'রেস্তোরাঁ তথ্য',
        openingHours: 'খোলার সময়',
        closed: 'বন্ধ',
        todaySpecial: 'আজকের বিশেষ',
        description: 'বর্ণনা',
        addCart: 'কার্টে যোগ করুন',
        price: 'মূল্য',
        category: 'বিভাগ',
        
        // Login/Register
        createAccount: 'অ্যাকাউন্ট তৈরি করুন',
        registerWithIUT: 'আপনার আইইউটি শিক্ষার্থী আইডি দিয়ে নিবন্ধন করুন',
        signIn: 'সাইন ইন করুন',
        forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
        alreadyHave: 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
        dontHave: 'অ্যাকাউন্ট নেই?',
        year: 'বছর',
        alreadyExists: 'এই ইমেল বা আইডি সহ একজন শিক্ষার্থী ইতিমধ্যে বিদ্যমান',
        registrationSuccess: 'নিবন্ধন সফল',
        loginSuccess: 'আপনাকে স্বাগতম!',
        invalidCredentials: 'অবৈধ ইমেল বা পাসওয়ার্ড',
        
        // Account
        accountDetails: 'অ্যাকাউন্ট বিবরণ',
        fullName: 'পূর্ণ নাম',
        removePhoto: 'ছবি সরান',
        changePhoto: 'ছবি পরিবর্তন করুন',
        signOut: 'সাইন আউট',
        profile: 'প্রোফাইল',
        
        // Auth
        login: 'লগইন',
        register: 'নিবন্ধন',
        confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
        studentId: 'শিক্ষার্থী আইডি',
        name: 'নাম',
        department: 'বিভাগ',
        
        // Admin
        analytics: 'বিশ্লেষণ',
        adminMenu: 'অ্যাডমিন মেনু',
        menuManagement: 'মেনু ব্যবস্থাপনা',
        addMenuItem: 'মেনু আইটেম যোগ করুন',
        editMenuItem: 'মেনু আইটেম সম্পাদনা করুন',
        deleteMenuItem: 'মেনু আইটেম মুছুন',
        stockManagement: 'স্টক ব্যবস্থাপনা',
        userManagement: 'ব্যবহারকারী ব্যবস্থাপনা',
        
        // Status & Filters
        all: 'সব',
        active: 'সক্রিয়',
        inactive: 'নিষ্ক্রিয়',
        search: 'খুঁজুন',
        filter: 'ফিল্টার',
        sort: 'সাজান',
        duration: 'সময়কাল',
        
        // QR Code
        showQR: 'কিউআর দেখুন',
        yourQRCode: 'আপনার কিউআর কোড',
        showAtCounter: 'ক্যাফেটেরিয়া কাউন্টারে এই কিউআর কোডটি দেখান',
        trackOrder: 'অর্ডার ট্র্যাক করুন',
        
        // Common Actions
        proceed: 'এগিয়ে যান',
        confirm: 'নিশ্চিত করুন',
        cancel: 'বাতিল',
        apply: 'প্রয়োগ করুন',
        reset: 'রিসেট করুন',
        retry: 'আবার চেষ্টা করুন',
        success: 'সফল',
    }
}

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('language') || 'en'
    })

    useEffect(() => {
        localStorage.setItem('language', language)
        document.documentElement.lang = language
    }, [language])

    const t = (key) => {
        return translations[language]?.[key] || translations.en[key] || key
    }

    const toggleLanguage = () => {
        setLanguage(prev => prev === 'en' ? 'bn' : 'en')
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        // Return default values if not within provider
        return {
            language: 'en',
            setLanguage: () => {},
            toggleLanguage: () => {},
            t: (key) => translations.en[key] || key
        }
    }
    return context
}

export default LanguageContext
