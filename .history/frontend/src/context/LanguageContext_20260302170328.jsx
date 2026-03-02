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
        
        // Notifications
        notifications: 'Notifications',
        enableNotifications: 'Enable Notifications',
        notificationsEnabled: 'Notifications Enabled',
        orderReady: 'Your order is ready for pickup!',
        
        // Language
        language: 'Language',
        english: 'English',
        bangla: 'বাংলা',
        
        // Messages
        orderPlaced: 'Order placed successfully!',
        reviewSubmitted: 'Review submitted!',
        error: 'Something went wrong',
        insufficientBalance: 'Insufficient balance',
    },
    bn: {
        // Common
        loading: 'লোড হচ্ছে...',
        cancel: 'বাতিল',
        submit: 'জমা দিন',
        save: 'সংরক্ষণ',
        delete: 'মুছুন',
        edit: 'সম্পাদনা',
        confirm: 'নিশ্চিত',
        close: 'বন্ধ',
        back: 'পিছনে',
        next: 'পরবর্তী',
        previous: 'আগের',
        page: 'পৃষ্ঠা',
        
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
        allStatuses: 'সকল অবস্থা',
        noOrders: 'কোনো অর্ডার নেই',
        amount: 'পরিমাণ',
        date: 'তারিখ',
        scheduledPickup: 'নির্ধারিত পিকআপ',
        
        // Order Status
        pending: 'অপেক্ষমাণ',
        verified: 'যাচাইকৃত',
        preparing: 'প্রস্তুত হচ্ছে',
        ready: 'প্রস্তুত',
        pickedUp: 'সংগৃহীত',
        completed: 'সম্পন্ন',
        failed: 'ব্যর্থ',
        
        // Reviews
        writeReview: 'রিভিউ লিখুন',
        reviewOrder: 'অর্ডার রিভিউ',
        rating: 'রেটিং',
        comment: 'মন্তব্য (ঐচ্ছিক)',
        shareExperience: 'আপনার অভিজ্ঞতা শেয়ার করুন...',
        submitReview: 'রিভিউ জমা দিন',
        submitting: 'জমা হচ্ছে...',
        avgRating: 'গড় রেটিং',
        reviews: 'রিভিউ',
        noReviews: 'কোনো রিভিউ নেই',
        
        // QR Code
        showQR: 'QR দেখুন',
        qrPickup: 'পিকআপের জন্য QR কোড',
        scanAtCounter: 'কাউন্টারে এই কোড স্ক্যান করুন',
        
        // Cafeteria
        cafeteria: 'ক্যাফেটেরিয়া',
        menu: 'মেনু',
        addToCart: 'কার্টে যোগ করুন',
        outOfStock: 'স্টক নেই',
        orderNow: 'এখনই অর্ডার করুন',
        scheduleOrder: 'অর্ডার সিডিউল করুন',
        selectPickupTime: 'পিকআপের সময় নির্বাচন করুন',
        pickupTime: 'পিকআপের সময়',
        
        // Wallet
        balance: 'ব্যালেন্স',
        addFunds: 'টাকা যোগ করুন',
        transactions: 'লেনদেন',
        
        // Auth
        login: 'লগইন',
        register: 'নিবন্ধন',
        email: 'ইমেইল',
        password: 'পাসওয়ার্ড',
        confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
        studentId: 'শিক্ষার্থী আইডি',
        name: 'নাম',
        department: 'বিভাগ',
        
        // Notifications
        notifications: 'বিজ্ঞপ্তি',
        enableNotifications: 'বিজ্ঞপ্তি সক্রিয় করুন',
        notificationsEnabled: 'বিজ্ঞপ্তি সক্রিয়',
        orderReady: 'আপনার অর্ডার প্রস্তুত!',
        
        // Language
        language: 'ভাষা',
        english: 'English',
        bangla: 'বাংলা',
        
        // Messages
        orderPlaced: 'অর্ডার সফলভাবে দেওয়া হয়েছে!',
        reviewSubmitted: 'রিভিউ জমা দেওয়া হয়েছে!',
        error: 'কিছু ভুল হয়েছে',
        insufficientBalance: 'অপর্যাপ্ত ব্যালেন্স',
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
