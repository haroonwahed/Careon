export type Language = "en" | "fr";
export type Locale = "en-GB" | "fr-FR";

// Translation dictionaries
export const translations = {
  en: {
    // Navigation
    nav: {
      connectAccount: "Connect Account",
      accountLauncher: "Account Launcher",
      dashboard: "Dashboard",
      orders: "My Orders",
      ordersSales: "Sales",
      ordersPurchases: "Purchases",
      wallet: "Wallet",
      notifications: "Notifications",
      messages: "Messages",
      stockManager: "Stock Manager",
      listingsPublisher: "Listings Publisher",
      publishedListings: "Published listings",
      settings: "Settings",
      trackingProducts: "Tracking → Products",
      trackingVendors: "Tracking → Vendors",
      trackingPublic: "Tracking → Public",
      collapse: "Collapse sidebar",
      expand: "Expand sidebar",
      section: {
        accounts: "Accounts",
        core: "Core",
        operations: "Sales-Purchase",
        listings: "Listings",
      }
    },
    
    // Topbar
    topbar: {
      searchPlaceholder: "Search anything... (⌘K)",
      language: "Language",
      account: "Account",
      myAccount: "My Account",
      profile: "Profile",
      billing: "Billing",
      logout: "Log out",
    },
    
    // Date ranges
    range: {
      today: "Today",
      yesterday: "Yesterday",
      last30min: "Last 30 minutes",
      last12h: "Last 12 hours",
      last7d: "Last 7 days",
      last30d: "Last 30 days",
      last60d: "Last 60 days",
      last90d: "Last 90 days",
      last365d: "Last 365 days",
      last12mo: "Last 12 months",
      last2mo: "Last 2 months",
      last3mo: "Last 3 months",
      last6mo: "Last 6 months",
      ytd: "Year to date",
      fixed: "Fixed",
      rolling: "Rolling",
      apply: "Apply",
      cancel: "Cancel",
      compareToPrevious: "Compare to previous period",
      customRange: "Custom range",
      selectDates: "Select dates",
      from: "From",
      to: "To",
    },
    
    // KPIs
    kpi: {
      revenue: "Revenue",
      sales: "Number of sales",
      marginPct: "Margin %",
      netMargin: "Net margin",
      avgBasket: "Average basket",
      revenueShare: "Revenue share by account",
    },
    
    // Delta
    delta: {
      vsPrevPeriod: "vs previous period",
      vsYesterday: "vs yesterday",
      vs7d: "vs prev 7d",
      vs30d: "vs prev 30d",
      vs90d: "vs prev 90d",
      vsLastYear: "vs last year",
      prevPeriod: "Prev period",
      currentPeriod: "Current period",
      comparison: "Comparison",
    },
    
    // Charts
    chart: {
      revenue: "Revenue",
      margin: "Net Margin",
      sales: "Sales",
      marginPct: "Margin %",
      avgBasket: "Average Basket",
      trend: "Trend",
      total: "Total",
      average: "Average",
      showComparison: "Show comparison",
      hideComparison: "Hide comparison",
      current: "Current",
      previous: "Previous",
      change: "Change",
      previousPeriod: "Previous period",
    },
    
    // Messages
    messages: {
      title: "Messages",
      lastMessages: "Last messages",
      makeOffer: "Make an offer",
      sendMessage: "Send a message",
      typeMessage: "Type your message...",
      search: "Search messages...",
      info: {
        tooltip: "Information",
      },
      actions: {
        downloadLabel: "Download label",
        trackParcel: "Track parcel",
        cancelOrder: "Cancel order",
        reportProblem: "Report a problem",
      },
      offer: {
        makeOffer: "Make an offer",
        modal: {
          title: "Make an offer",
          priceLabel: "Your offer (€)",
          messageLabel: "Message (optional)",
          messagePlaceholder: "Add a message to your offer...",
          send: "Send offer",
          cancel: "Cancel",
          validationRequired: "Please enter an offer amount",
          validationPositive: "Offer must be greater than 0",
          validationLowerThanPrice: "Offer must be lower than the asking price",
        },
        card: {
          sent: "Offer sent",
          accepted: "Accepted",
          declined: "Declined",
          countered: "Counter offer",
          expired: "Expired",
        },
        action: {
          accept: "Accept",
          counter: "Counter",
          decline: "Decline",
        },
        counterModal: {
          title: "Send counter-offer",
          priceLabel: "Counter offer (€)",
          send: "Send counter-offer",
          cancel: "Cancel",
        },
      },
      time: {
        justNow: "Just now",
        minutesAgo: "{count} minute ago",
        minutesAgo_plural: "{count} minutes ago",
        hoursAgo: "{count} hour ago",
        hoursAgo_plural: "{count} hours ago",
        daysAgo: "{count} day ago",
        daysAgo_plural: "{count} days ago",
        weeksAgo: "{count} week ago",
        weeksAgo_plural: "{count} weeks ago",
        yesterday: "Yesterday",
      },
      conversation: {
        back: "Back to messages",
        viewListing: "View listing",
        title: "Conversation",
        item: {
          makeOffer: "Make an offer",
          offer: "Offer",
          base: "Base",
          total: "Total",
          activeListing: "Active listing",
          price: "Price",
          subtotal: "Subtotal for buyer",
        },
        user: {
          lastSeen: "Last seen {time}",
          rating: "Rating",
          reviews: "reviews",
        },
        compose: {
          placeholder: "Send a message to {name}",
          send: "Send",
          addPhoto: "Add photo",
        },
        actions: {
          accept: "Accept",
          decline: "Decline",
          counter: "Counter",
        },
        dialog: {
          title: "Make an offer",
          yourOffer: "Your offer",
          quickDiscounts: "Quick discounts",
          itemPrice: "Item price",
          serviceFee: "Service fee (5%)",
          buyerTotal: "Buyer total",
          noteOptional: "Note (optional)",
          notePlaceholder: "Add a message to your offer...",
          cancel: "Cancel",
          sendOffer: "Send offer",
          sending: "Sending...",
          required: "*",
          errors: {
            validPrice: "Please enter a valid price",
            greaterThanZero: "Price must be greater than 0",
            lowerThanBase: "Offer must be lower than base price",
          },
        },
      },
      system: {
        accepted: "You accepted the offer",
        declined: "You declined the offer",
        cancelled: "Buyer cancelled the order",
        orderCreated: "Order created",
        orderShipped: "Order shipped",
        orderDelivered: "Order delivered",
        soldShipBefore: "Sold — Ship before {date}",
        daysLeftToShip: "{count} day left to ship",
        daysLeftToShip_plural: "{count} days left to ship",
        buyerPaidShipping: "Buyer paid shipping",
      },
      translate: {
        button: "Translate message",
        buttonShowOriginal: "Show original",
        labelTranslatedFrom: "Translated from {language}",
      },
      languageNames: {
        english: "English",
        spanish: "Spanish",
        french: "French",
        german: "German",
        italian: "Italian",
        portuguese: "Portuguese",
        dutch: "Dutch",
        polish: "Polish",
      },
      empty: {
        title: "No messages",
        description: "Your conversations will appear here",
        noMessagesYet: "No messages yet. Start the conversation.",
      },
      error: {
        send: "Failed to send message. Try again.",
      },
      inline: {
        download: "Download",
        downloadLabel: "Download label",
      },
    },
    
    // Notifications
    notifications: {
      title: "Notifications",
      favoritesOnly: "Favorites only",
      markAllRead: "Mark all as read",
      empty: {
        title: "No notifications",
        description: "You're all caught up!",
      },
      types: {
        newMessage: "New message",
        newOffer: "New offer",
        offerAccepted: "Offer accepted",
        offerDeclined: "Offer declined",
        itemSold: "Item sold",
        itemShipped: "Item shipped",
        itemDelivered: "Item delivered",
        newFavorite: "New favorite",
        priceReduced: "Price reduced",
      },
    },
    
    // Orders
    orders: {
      title: "My Orders",
      nav: {
        myOrders: "My orders",
      },
      tabs: {
        all: "All",
        inProgress: "In progress",
        toProcess: "To process",
        toHandIn: "To hand in",
        shipped: "Shipped",
        finished: "Finished",
        cancelled: "Cancelled",
        sales: "Sales",
        purchases: "Purchases",
      },
      kpi: {
        toProcess: "To process",
        toHandIn: "To hand in",
        shipped: "Shipped",
      },
      status: {
        pending: "Pending",
        paid: "Paid",
        shipped: "Shipped",
        delivered: "Delivered",
        cancelled: "Cancelled",
        refunded: "Refunded",
        waiting_label: "Waiting for label",
        label_sent: "Label sent to seller",
        shipped: "Order shipped",
        in_transit: "In transit",
        return_initiated: "Return initiated",
        cancelled_buyer: "Cancelled by buyer",
        cancelled_seller: "Cancelled by seller",
        cancelled_system: "Cancelled",
      },
      action: {
        markProcessed: "Mark as processed",
        downloadLabel: "Download label",
        undoProcessed: "Undo processed",
      },
      bulkLabels: {
        button: "Download all labels",
        tooltip: "Download every label that is ready/awaiting download",
        confirm: {
          title: "Download all labels now?",
          body: "You are about to download {count} label(s).",
          confirm: "Confirm",
          cancel: "Cancel",
        },
        toast: {
          success: "All labels downloaded",
          partial: "Some labels couldn't be downloaded",
        },
      },
      badge: {
        processed: "Processed",
        waitingLabel: "Waiting for label",
      },
      menu: {
        viewOnVinted: "View on Vinted",
        viewDetails: "View details",
      },
      details: {
        title: "Order details",
        orderNumber: "Order #",
        date: "Date",
        buyer: "Buyer",
        seller: "Seller",
        item: "Item",
        price: "Price",
        shipping: "Shipping",
        total: "Total",
        status: "Status",
        timeline: "Timeline",
        actions: "Actions",
        openInVinted: "Open in Vinted",
        printLabel: "Print label",
        contactBuyer: "Contact buyer",
        contactSeller: "Contact seller",
      },
      modal: {
        title: "Order details",
        sku: "SKU",
        salePrice: "Sale price",
        netMargin: "Net margin",
        quantity: "Quantity",
        bundle: {
          no: "Not a bundle",
          yes: "Bundle ({count})",
        },
        goToChat: "Go to conversation",
      },
      timeline: {
        orderPlaced: "Order placed",
        paymentReceived: "Payment received",
        preparing: "Preparing for shipment",
        shipped: "Shipped",
        inTransit: "In transit",
        delivered: "Delivered",
      },
      empty: {
        title: "No orders",
        description: "Your orders will appear here",
        toHandIn: "No parcels to hand in.",
      },
      sales: {
        action: {
          downloadLabel: "Download label",
          downloadLabelTooltip: "Download shipping label",
        },
        toast: {
          labelDownloaded: "Label downloaded",
        },
      },
      purchases: {
        action: {
          addToStock: "Add to stock",
          addToStockTooltip: "Add this purchase to your stock",
        },
        toast: {
          addedToStock: "Product added to stock",
        },
      },
    },
    
    // Stock Manager
    stock: {
      title: "Stock Manager",
      addProduct: "Add product",
      editProduct: "Edit product",
      deleteProduct: "Delete product",
      search: "Search by title or SKU",
      filter: {
        status: "Status",
        category: "Category",
        brand: "Brand",
        size: "Size",
        condition: "Condition",
        material: "Material",
        priceRange: "Price range",
        updated: "Last updated",
      },
      fields: {
        title: "Title",
        photos: "Photos",
        description: "Description",
        category: "Category",
        brand: "Brand",
        condition: "Condition",
        material: "Material",
        color: "Color",
        size: "Size",
        purchaseCost: "Purchase cost (€)",
        purchaseCostHelper: "Your buying cost (used to calculate margins). Not visible to buyers.",
        price: "Price (€)",
        packageSize: "Vinted parcel size",
        notes: "Internal notes",
        sku: "SKU",
        quantity: "Quantity",
      },
      skuMode: {
        auto: "Auto-generated",
        manual: "Manual SKU",
      },
      placeholders: {
        title: "e.g., Vintage Levi's 501 Jeans",
        description: "Describe the item condition, measurements, and any special features...",
        material: "e.g., Cotton, Polyester",
        size: "e.g., M, W32 L34",
        notes: "Private notes (not visible to buyers)",
        selectCategory: "Select category",
        selectBrand: "Select brand",
        skuManual: "Enter your own SKU",
      },
      helpers: {
        skuAuto: "SKU generated automatically from date and a random ID.",
        skuManual: "Use your own stock coding (e.g. rack or box ID).",
        photos: "Add up to 20 photos. First photo will be the main image.",
        vintedfee: "Vinted fee: ~5%",
        vintedParcelSize: "Choose the parcel size as defined on Vinted.",
        quantity: "Stock quantity (used in inventory value calculations)",
        notesPrivate: "These notes are for your reference only and won't be published.",
      },
      buttons: {
        regenerateSKU: "Regenerate SKU",
        saving: "Saving...",
      },
      modal: {
        addTitle: "Add product",
        editTitle: "Edit product",
        addSubtitle: "Add a new product to your inventory",
        editSubtitle: "Update product information",
      },
      conditions: {
        new: "New with tags",
        veryGood: "Very good",
        good: "Good",
        satisfactory: "Satisfactory",
      },
      packageSizes: {
        small: "Small parcel",
        medium: "Medium parcel",
        large: "Large parcel",
      },
      summary: {
        totalItems: "Total items",
        inventoryValue: "Inventory value",
        inventoryValueCost: "Inventory value — Cost",
        inventoryValueResale: "Inventory value — Resale",
        cost: "Cost",
        resale: "Resale",
        potentialMargin: "Potential margin",
      },
      columns: {
        thumbnail: "Thumbnail",
        photo: "Photo",
        title: "Title",
        sku: "SKU",
        category: "Category",
        brand: "Brand",
        condition: "Condition",
        material: "Material",
        size: "Size",
        purchaseCost: "Purchase cost (€)",
        cost: "Cost",
        price: "Price (€)",
        packageSize: "Package size",
        quantity: "Quantity",
        updated: "Updated",
        margin: "Margin",
        status: "Status",
        actions: "Actions",
      },
      status: {
        inStock: "In stock",
        listed: "Listed",
        sold: "Sold",
        reserved: "Reserved",
      },
      actions: {
        view: "View",
        edit: "Edit",
        archive: "Archive",
        publish: "Publish",
        delete: "Delete",
        save: "Save",
        saveDraft: "Save as draft",
        cancel: "Cancel",
      },
      empty: {
        title: "No products in stock",
        description: "Add your first product to get started",
        noProductsYet: "No products in stock yet. Add your first product.",
      },
      errors: {
        load: "Failed to load products.",
        purchaseCostPositive: "Purchase cost must be a positive number.",
        pricePositive: "Price must be a positive number.",
        titleRequired: "Title is required.",
        skuRequired: "SKU is required.",
        skuInvalid: "SKU format is invalid.",
      },
      deleteConfirm: {
        title: "Delete product",
        description: "Are you sure you want to delete this product? This action cannot be undone.",
        confirm: "Delete",
        cancel: "Cancel",
      },
    },
    
    // Listings Publisher
    publisher: {
      title: "Listings Publisher",
      subtitle: "Publish products from your stock to your Vinted accounts.",
      publish: "Publish",
      publishToAccount: "Publish to account",
      selectAccount: "Select account",
      selectProduct: "Select product",
      activeListings: "Active listings",
      publishedOn: "Published on",
      search: "Search by title, SKU or listing ID",
      sortBy: "Sort by",
      sortOptions: {
        created: "Created (newest)",
        sync: "Last sync",
        price: "Price (highest)",
      },
      allStatus: "All status",
      status: {
        queued: "Queued",
        posting: "Posting...",
        active: "Active",
        failed: "Failed",
        ended: "Ended",
        paused: "Paused",
        sold: "Sold",
      },
      columns: {
        thumbnail: "Thumbnail",
        listing: "Listing",
        title: "Title",
        sku: "SKU",
        account: "Account",
        listingId: "Listing ID",
        published: "Published",
        created: "Created",
        lastSync: "Last sync",
        status: "Status",
        price: "Price (€)",
        views: "Views",
        favorites: "Favorites",
        actions: "Actions",
      },
      actions: {
        pause: "Pause",
        resume: "Resume",
        end: "End listing",
        retry: "Retry",
        refresh: "Refresh",
        viewOnVinted: "View on Vinted",
      },
      empty: {
        title: "No active listings",
        description: "Publish your first listing to get started",
        noListingsYet: "No listings yet. Publish from your stock to create your first listing.",
      },
      form: {
        title: "Publish product",
        subtitle: "Choose the SKU and account, then publish this product to Vinted.",
        sku: "SKU",
        selectSKU: "Select SKU",
        searchSKU: "Search by SKU or title...",
        account: "Account",
        selectAccount: "Select account",
        priceOverride: "Price (€)",
        packageSizeOverride: "Package size",
        notes: "Notes (optional)",
        notesPlaceholder: "Internal note for this listing...",
        publish: "Publish",
        publishing: "Publishing...",
        cancel: "Cancel",
      },
      helpers: {
        priceOverride: "Leave empty to use the stock price.",
        packageSizeOverride: "Leave empty to use the stock package size.",
      },
      errors: {
        load: "Failed to load listings.",
        publish: "Failed to publish listing. Try again.",
        skuRequired: "SKU is required.",
        accountRequired: "Account is required.",
        validPrice: "Please enter a valid price.",
      },
      toast: {
        publishSuccess: "Published to {account}",
        selectRequired: "Please select a SKU and account",
      },
      dialog: {
        title: "Publish product(s)",
        description: "Select accounts to publish {count} product(s) to Vinted",
        selectAccounts: "Select accounts",
        selectAll: "Select all",
        deselectAll: "Deselect all",
        productsToPublish: "Products to publish",
        publishingOptions: "Publishing options",
        autoPriceRounding: "Auto price rounding",
        autoPriceRoundingDesc: "Round prices to .99 (e.g., €45.00 → €44.99)",
        autoTranslate: "Auto translate description",
        comingSoon: "Coming soon",
        publishingStatus: "Publishing status",
        publishToAccounts: "Publish to {count} account(s)",
        closeWhenDone: "Close when done",
        statusQueued: "Queued",
        statusPosting: "Posting...",
        statusPosted: "Posted",
        statusFailed: "Failed",
      },
    },
    
    // Account Launcher
    accountLauncher: {
      title: "Account Launcher",
      subtitle: "Launch and manage profiles; start/stop accounts and open sessions.",
      createProfile: "Connect new account",
      
      // Profile card
      profile: {
        openVinted: "Open Vinted interface",
        connect: "Connect profile",
        reconnect: "Reconnect",
        connected: "Connected",
        disconnect: "Disconnect",
        stopVinted: "Stop Vinted",
        startVinted: "Start Vinted",
        deleteProfile: "Delete profile",
        
        // Status chips
        statusRunning: "Running",
        statusStopped: "Stopped",
        statusConnected: "Connected",
        statusDisconnected: "Disconnected",
        
        // Proxy info
        proxyHost: "Proxy host",
        proxyPort: "Proxy port",
        noProxy: "Proxy: —",
      },
      
      // Create/Edit Profile Modal
      modal: {
        createTitle: "Connect new account",
        editTitle: "Edit profile",
        
        // Section 1: Credentials
        sectionCredentials: "Account credentials",
        email: "Email",
        emailPlaceholder: "name@example.com",
        password: "Password",
        passwordPlaceholder: "••••••••",
        securityNote: "Stored securely. Never shared.",
        encryptionNote: "We encrypt credentials at rest.",
        appPasswordLink: "Use an app password?",
        
        // Section 2: Proxy
        sectionProxy: "Proxy",
        proxyHost: "Proxy host",
        proxyHostPlaceholder: "proxy.myhost.com",
        proxyPort: "Proxy port",
        proxyPortPlaceholder: "8080",
        proxyUser: "Proxy user",
        proxyUserPlaceholder: "username",
        proxyPassword: "Proxy password",
        proxyPasswordPlaceholder: "••••••••",
        
        // Section 3: Interface (ex-VNC)
        sectionInterface: "Interface",
        interfacePassword: "Interface password",
        interfacePasswordPlaceholder: "••••••••",
        interfaceHelperText: "Used to secure access to the account interface.",
        
        // Section 4: Profile name
        sectionProfileName: "Profile name",
        profileName: "Profile name",
        profileNamePlaceholder: "Boutique Alice",
        
        // Actions
        save: "Save profile",
        saving: "Saving...",
        cancel: "Cancel",
      },
      
      // Tip callout
      tip: {
        title: "Tip:",
        text: "Launching an account opens the Vinted activity session in a new web view, allowing you to monitor and manage the account automatically.",
      },
      
      // Toasts
      toast: {
        profileCreated: "Profile created successfully",
        profileUpdated: "Profile updated successfully",
        profileDeleted: "Profile deleted",
        sessionStarted: "Session started",
        sessionStopped: "Session stopped",
        connected: "Profile connected",
        disconnected: "Profile disconnected",
      },
      
      // Delete confirmation
      deleteConfirm: {
        title: "Delete profile?",
        message: "This will permanently delete the profile and all its data. This action cannot be undone.",
        confirm: "Delete",
        cancel: "Cancel",
      },
    },
    
    // Published Listings
    published: {
      title: "Published listings",
      accountSelect: {
        placeholder: "Select an account",
      },
      tabs: {
        active: "Active",
        sold: "Sold",
      },
      search: {
        placeholder: "Search by title or SKU",
      },
      sort: {
        label: "Sort",
        newest: "Most recent",
        views: "Most views",
        favorites: "Most favorites",
        hidden: "Hidden",
        boostActive: "Boost active",
      },
      button: {
        boost: "Boost",
        repost: "Repost",
      },
      status: {
        active: "Active",
        boostActive: "Boost active",
        hidden: "Hidden",
        needsRepost: "Needs repost",
        lowPhotos: "Low photos",
        sold: "Sold",
      },
      action: {
        viewOnVinted: "View on Vinted",
        copyLink: "Copy link",
        hide: "Hide listing",
        delete: "Delete listing",
        saveChanges: "Save changes",
      },
      drawer: {
        tab: {
          details: "Details",
          analytics: "Analytics",
          recommendations: "Recommendations",
        },
        postedDaysAgo: "Posted {count} day ago",
        postedDaysAgo_plural: "Posted {count} days ago",
      },
      analytics: {
        views: "Views",
        favorites: "Favorites",
        offers: "Offers",
        avgOffer: "Avg offer",
        bestOffer: "Best offer",
        lowestOffer: "Lowest offer",
        viewsOverTime: "Views over time",
        favoritesOverTime: "Favorites over time",
        offersPerDay: "Offers per day",
        last7Days: "Last 7 days",
        last30Days: "Last 30 days",
        last90Days: "Last 90 days",
        noData: "No data available",
        trend: "vs previous period",
      },
      insight: {
        severity: {
          info: "Info",
          warning: "Warning",
          critical: "Critical",
        },
        photos: {
          title: "Add more photos",
          description: "Listings with 5+ photos get {percent}% more views",
          cta: "Edit photos",
        },
        oldListing: {
          title: "Listing is old",
          description: "This listing is older than {days} days. Repost to boost visibility.",
          cta: "Repost now",
        },
        lowEngagement: {
          title: "Low engagement",
          description: "Consider lowering price by 5–10% or improving the first photo.",
          cta: "Edit listing",
        },
        offersLow: {
          title: "Offers below price",
          description: "Offers are {percent}% below your price. Consider adjusting price or description.",
          cta: "Adjust price",
        },
        missingBrand: {
          title: "Missing brand",
          description: "Adding a brand increases buyer trust and visibility.",
          cta: "Add brand",
        },
        shortDescription: {
          title: "Description too short",
          description: "Detailed descriptions get {percent}% more favorites.",
          cta: "Improve description",
        },
        hidden: {
          title: "Listing is hidden",
          description: "Unhide this listing to regain visibility and attract buyers.",
          cta: "Unhide listing",
        },
        boostActive: {
          title: "Boost is active",
          description: "Your listing is currently boosted and will remain active until {date}.",
          cta: "View analytics",
        },
      },
      toast: {
        boosted: "Listing boosted",
        reposted: "Listing reposted successfully",
        linkCopied: "Link copied to clipboard",
        saved: "Changes saved",
        hidden: "Listing hidden",
        deleted: "Listing deleted",
      },
      modal: {
        repost: {
          title: "Repost this listing?",
          description: "Reposting helps the listing appear higher in the feed.",
          confirm: "Repost",
          cancel: "Cancel",
        },
      },
      empty: {
        selectAccount: "Select an account to view its listings.",
        noListings: "No listings yet for this account.",
      },
      backToListings: "Back to listings",
      stats: {
        views: "views",
        favorites: "favorites",
        offers: "offers",
      },
      dialog: {
        boost: {
          title: "Boost this listing?",
          description: "Boosting will promote your listing and increase its visibility.",
          confirm: "Boost",
          cancel: "Cancel",
        },
      },
    },
    
    // Wallet
    wallet: {
      title: "Wallet",
      subtitle: "Track your earnings, withdrawals, and finalized sales per account.",
      kpi: {
        available: "Available for withdrawal",
        pending: "Pending balance",
        updatedRealtime: "Updated in real-time",
        awaitingRelease: "Awaiting release",
      },
      button: {
        transfer: "Transfer",
      },
      modal: {
        transfer: {
          title: "Transfer to your bank",
          available: "Available amount",
          amountLabel: "Amount to transfer",
          confirm: "Confirm transfer",
          cancel: "Cancel",
        },
      },
      activity: {
        title: "Financial activity",
        type: {
          sale: "Finalized sale",
          transfer: "Bank transfer",
        },
        status: {
          finalized: "Finalized",
          completed: "Completed",
        },
        goToConversation: "Go to conversation",
        noActivity: "No financial activity yet",
      },
      toast: {
        transferSuccess: "Transfer initiated successfully",
        transferError: "Transfer failed. Please try again.",
      },
    },
    
    // Settings
    settings: {
      title: "Settings",
      profile: "Profile",
      security: "Security",
      preferences: "Preferences",
      subscription: "Subscription",
      username: "Username",
      email: "Email address",
      save: "Save",
      cancel: "Cancel",
      currentPassword: "Current password",
      newPassword: "New password",
      confirmPassword: "Confirm new password",
      updatePassword: "Update password",
      language: "Language",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      system: "System",
      english: "English",
      french: "Français",
      notifications: {
        title: "Notifications",
        email: "Email notifications",
        push: "Push notifications",
        newMessages: "New messages",
        newOffers: "New offers",
        orderUpdates: "Order updates",
        favorites: "Favorites",
      },
    },
    
    // Subscription
    subscription: {
      currentPlan: "Current Plan",
      planName: "Plan",
      price: "Price",
      nextBilling: "Next billing date",
      status: "Status",
      active: "Active",
      trial: "Trial",
      pastDue: "Past due",
      canceled: "Canceled",
      features: "Included features",
      changePlan: "Change Plan",
      selectPlan: "Select a plan",
      updatePlan: "Update Plan",
      planChangeImmediate: "Your plan will change immediately",
      planChangeNextCycle: "Your plan will change on the next billing cycle",
      paymentMethod: "Payment Method",
      noPaymentMethod: "No payment method on file",
      updatePaymentMethod: "Update Payment Method",
      billingHistory: "Billing History",
      viewBillingHistory: "View Billing History",
      cancelSubscription: "Cancel Subscription",
      cancelAnytime: "You can cancel your subscription anytime",
      confirmCancel: "Are you sure you want to cancel?",
      cancelReason: "Reason for canceling",
      confirmCancellation: "Confirm Cancellation",
      keepSubscription: "Keep Subscription",
      invoiceNumber: "Invoice #",
      date: "Date",
      amount: "Amount",
      paid: "Paid",
      refunded: "Refunded",
      failed: "Failed",
      download: "Download",
      starter: "Starter",
      pro: "Pro",
      scale: "Scale",
      perMonth: "/month",
      mostPopular: "Most popular",
      currentPlanBadge: "Current plan",
      choosePlan: "Choose plan",
      // Plan features
      multiAccount: "Multi-account",
      upToAccounts: "Up to {count} connected accounts",
      performanceDashboard: "Performance dashboard (revenue, sales, margin rate, etc.)",
      messagesNotifications: "Centralized messages & notifications",
      ordersManagement: "Orders management",
      stockManager: "Stock manager (SKU, condition, cost, location)",
      autoPublishing: "Auto-publishing",
      autoPublishingLimit: "Auto-publishing: up to {count} listings",
      autoPublishingUnlimited: "Auto-publishing: unlimited",
      autoOffers: "Auto-offers",
      autoOffersLimit: "Auto-offers: up to {count} offers",
      autoOffersUnlimited: "Auto-offers: unlimited",
      support247: "Support 7/7 days",
      responseRate: "Performance dashboard (revenue, sales, response rate)",
    },
    
    // Filters
    filters: {
      search: "Search...",
      refresh: "Refresh",
      accounts: {
        all: "All accounts",
        selected: "Selected ({count})",
        title: "Filter by account",
        selectAll: "Select all",
        clear: "Clear",
        noAccounts: "No accounts",
      },
    },
    
    // Common
    common: {
      search: "Search",
      filter: "Filter",
      sort: "Sort",
      all: "All",
      accounts: "Accounts",
      account: "Account",
      selectedAccounts: "Selected accounts",
      allAccounts: "All accounts",
      loading: "Loading...",
      error: "Error",
      retry: "Retry",
      delete: "Delete",
      edit: "Edit",
      view: "View",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      confirm: "Confirm",
      back: "Back",
      next: "Next",
      previous: "Previous",
      export: "Export",
      import: "Import",
      download: "Download",
      upload: "Upload",
      actions: "Actions",
      noResults: "No results",
      showMore: "Show more",
      showLess: "Show less",
      selectAll: "Select all",
      deselectAll: "Deselect all",
      refreshData: "Refresh data",
      newest: "Newest",
      oldest: "Oldest",
      priceAsc: "Price: Low to High",
      priceDesc: "Price: High to Low",
    },
    
    // Connect Account
    connect: {
      title: "Create a profile",
      description: "Connect your Vinted account and optional proxy/VNC settings. You can edit these later.",
      connectButton: "Connect Vinted Account",
      connectedAccounts: "Connected Profiles",
      connectedProfiles: "Connected Profiles",
      addAnother: "Add another account",
      createNewProfile: "Create New Profile",
      createProfile: "Create profile",
      creatingProfile: "Creating profile...",
      profileCreatedSuccess: "Profile created successfully!",
      account: "Account",
      email: "Email",
      emailPlaceholder: "name@example.com",
      password: "Password",
      passwordPlaceholder: "••••••••",
      proxyVnc: "Proxy & VNC (optional)",
      proxyHost: "Proxy host",
      proxyHostPlaceholder: "proxy.myhost.com",
      proxyPort: "Proxy port",
      proxyPortPlaceholder: "8080",
      proxyUser: "Proxy user",
      proxyUserPlaceholder: "username",
      proxyPassword: "Proxy password",
      vncPassword: "VNC password",
      passwordStrength: {
        weak: "Weak",
        medium: "Medium",
        strong: "Strong",
      },
      securityNote: "Stored securely. Never shared.",
      useAppPassword: "Use app password?",
      encryptionNote: "We encrypt credentials at rest.",
      proxyInfo: "HTTP/SOCKS proxies supported. Leave blank if not using a proxy. VNC password secures remote sessions.",
      credentialsNote: "Credentials are used only for this profile.",
      validation: {
        emailRequired: "Email is required",
        emailInvalid: "Please enter a valid email address",
        passwordRequired: "Password is required",
        passwordTooShort: "Password must be at least 8 characters",
        portInvalid: "Port must be between 1 and 65535",
      },
      empty: {
        title: "No profiles yet",
        description: "Create your first profile to get started.",
      },
    },
    
    // Account Launcher
    launcher: {
      title: "Account Launcher",
      description: "Start/stop each account; launching opens the account activity in a web view.",
      openInVinted: "Open in Vinted",
      launch: "Launch",
      stop: "Stop",
      running: "Running",
      stopped: "Stopped",
      launchedSuccess: "{name} launched successfully",
      stoppedSuccess: "{name} stopped",
      tip: "💡 Tip:",
      tipDescription: "Launching an account opens the Vinted activity session in a new web view, allowing you to monitor and manage the account automatically.",
      empty: {
        title: "No accounts connected",
        description: "Connect a Vinted account first to start launching accounts.",
      },
    },
    
    // Toasts
    toast: {
      success: "Success",
      error: "Error",
      warning: "Warning",
      info: "Info",
      languageChanged: "Language changed to English",
      themeChanged: "Theme changed to {theme}",
      profileUpdated: "Profile updated successfully",
      passwordUpdated: "Password updated successfully",
      planUpdated: "Plan updated successfully",
      subscriptionCanceled: "Subscription canceled. Renewal turned off.",
      productAdded: "Product added successfully",
      productUpdated: "Product updated successfully",
      productDeleted: "Product deleted successfully",
      listingPublished: "Listing published successfully",
      offerSent: "Offer sent successfully",
    },
    
    // Global Refresh
    globalRefresh: {
      tooltip: "Refresh everything",
      toastDone: "All data refreshed",
      toastError: "Some data failed to refresh.",
    },
  },
  fr: {
    // Navigation
    nav: {
      connectAccount: "Connecter un compte",
      accountLauncher: "Lanceur de comptes",
      dashboard: "Tableau de bord",
      orders: "Mes commandes",
      ordersSales: "Ventes",
      ordersPurchases: "Achats",
      wallet: "Portemonnaie",
      notifications: "Notifications",
      messages: "Messages",
      stockManager: "Gestion du stock",
      listingsPublisher: "Publication d'annonces",
      publishedListings: "Annonces publiées",
      settings: "Paramètres",
      trackingProducts: "Tracking → Produits",
      trackingVendors: "Tracking → Vendeurs",
      trackingPublic: "Tracking → Publiques",
      collapse: "Réduire la barre latérale",
      expand: "Développer la barre latérale",
      section: {
        accounts: "Comptes",
        core: "Principal",
        operations: "Vente-Achat",
        listings: "Annonces",
      }
    },
    
    // Topbar
    topbar: {
      searchPlaceholder: "Rechercher... (⌘K)",
      language: "Langue",
      account: "Compte",
      myAccount: "Mon compte",
      profile: "Profil",
      billing: "Facturation",
      logout: "Se déconnecter",
    },
    
    // Date ranges
    range: {
      today: "Aujourd'hui",
      yesterday: "Hier",
      last30min: "30 dernières minutes",
      last12h: "12 dernières heures",
      last7d: "7 derniers jours",
      last30d: "30 derniers jours",
      last60d: "60 derniers jours",
      last90d: "90 derniers jours",
      last365d: "365 derniers jours",
      last12mo: "12 derniers mois",
      last2mo: "2 derniers mois",
      last3mo: "3 derniers mois",
      last6mo: "6 derniers mois",
      ytd: "Depuis début d'année",
      fixed: "Fixe",
      rolling: "Glissant",
      apply: "Appliquer",
      cancel: "Annuler",
      compareToPrevious: "Comparer à la période précédente",
      customRange: "Période personnalisée",
      selectDates: "Sélectionner les dates",
      from: "Du",
      to: "Au",
    },
    
    // KPIs
    kpi: {
      revenue: "Chiffre d'affaires",
      sales: "Nombre de ventes",
      marginPct: "Marge %",
      netMargin: "Marge nette",
      avgBasket: "Panier moyen",
      revenueShare: "Part du CA par compte",
    },
    
    // Delta
    delta: {
      vsPrevPeriod: "vs période précédente",
      vsYesterday: "vs hier",
      vs7d: "vs 7j préc.",
      vs30d: "vs 30j préc.",
      vs90d: "vs 90j préc.",
      vsLastYear: "vs année dernière",
      prevPeriod: "Période préc.",
      currentPeriod: "Période actuelle",
      comparison: "Comparaison",
    },
    
    // Charts
    chart: {
      revenue: "Chiffre d'affaires",
      margin: "Marge nette",
      sales: "Ventes",
      marginPct: "Marge %",
      avgBasket: "Panier moyen",
      trend: "Tendance",
      total: "Total",
      average: "Moyenne",
      showComparison: "Afficher la comparaison",
      hideComparison: "Masquer la comparaison",
      current: "Actuelle",
      previous: "Précédente",
      change: "Variation",
      previousPeriod: "Période précédente",
    },
    
    // Messages
    messages: {
      title: "Messages",
      lastMessages: "Derniers messages",
      makeOffer: "Faire une offre",
      sendMessage: "Envoyer un message",
      typeMessage: "Saisissez votre message...",
      search: "Rechercher des messages...",
      info: {
        tooltip: "Information",
      },
      actions: {
        downloadLabel: "Télécharger le bordereau",
        trackParcel: "Suivre le colis",
        cancelOrder: "Annuler l'achat",
        reportProblem: "Signaler un problème",
      },
      offer: {
        makeOffer: "Faire une offre",
        modal: {
          title: "Faire une offre",
          priceLabel: "Votre offre (€)",
          messageLabel: "Message (facultatif)",
          messagePlaceholder: "Ajoutez un message à votre offre...",
          send: "Envoyer l'offre",
          cancel: "Annuler",
          validationRequired: "Veuillez saisir un montant",
          validationPositive: "L'offre doit être supérieure à 0",
          validationLowerThanPrice: "L'offre doit être inférieure au prix demandé",
        },
        card: {
          sent: "Offre envoyée",
          accepted: "Acceptée",
          declined: "Refusée",
          countered: "Contre-offre",
          expired: "Expirée",
        },
        action: {
          accept: "Accepter",
          counter: "Contre-offre",
          decline: "Refuser",
        },
        counterModal: {
          title: "Envoyer une contre-offre",
          priceLabel: "Contre-offre (€)",
          send: "Envoyer la contre-offre",
          cancel: "Annuler",
        },
      },
      time: {
        justNow: "À l'instant",
        minutesAgo: "Il y a {count} minute",
        minutesAgo_plural: "Il y a {count} minutes",
        hoursAgo: "Il y a {count} heure",
        hoursAgo_plural: "Il y a {count} heures",
        daysAgo: "Il y a {count} jour",
        daysAgo_plural: "Il y a {count} jours",
        weeksAgo: "Il y a {count} semaine",
        weeksAgo_plural: "Il y a {count} semaines",
        yesterday: "Hier",
      },
      conversation: {
        back: "Retour aux messages",
        viewListing: "Voir l'annonce",
        title: "Conversation",
        item: {
          makeOffer: "Faire une offre",
          offer: "Offre",
          base: "Base",
          total: "Total",
          activeListing: "Annonce active",
          price: "Prix",
          subtotal: "Sous-total acheteur",
        },
        user: {
          lastSeen: "Vu {time}",
          rating: "Note",
          reviews: "avis",
        },
        compose: {
          placeholder: "Envoyer un message à {name}",
          send: "Envoyer",
          addPhoto: "Ajouter une photo",
        },
        actions: {
          accept: "Accepter",
          decline: "Décliner",
          counter: "Contre-offre",
        },
        dialog: {
          title: "Faire une offre",
          yourOffer: "Votre offre",
          quickDiscounts: "Réductions rapides",
          itemPrice: "Prix de l'article",
          serviceFee: "Frais de service (5%)",
          buyerTotal: "Total acheteur",
          noteOptional: "Note (facultatif)",
          notePlaceholder: "Ajoutez un message à votre offre...",
          cancel: "Annuler",
          sendOffer: "Envoyer l'offre",
          sending: "Envoi...",
          required: "*",
          errors: {
            validPrice: "Veuillez saisir un prix valide",
            greaterThanZero: "Le prix doit être supérieur à 0",
            lowerThanBase: "L'offre doit être inférieure au prix de base",
          },
        },
      },
      system: {
        accepted: "Vous avez accepté l'offre",
        declined: "Vous avez décliné l'offre",
        cancelled: "L'acheteur a annulé la commande",
        orderCreated: "Commande créée",
        orderShipped: "Commande expédiée",
        orderDelivered: "Commande livrée",
        soldShipBefore: "Vendu — Expédier avant le {date}",
        daysLeftToShip: "{count} jour restant pour expédier",
        daysLeftToShip_plural: "{count} jours restants pour expédier",
        buyerPaidShipping: "L'acheteur a payé l'expédition",
      },
      translate: {
        button: "Traduire ce message",
        buttonShowOriginal: "Afficher le message original",
        labelTranslatedFrom: "Traduit depuis l'{language}",
      },
      languageNames: {
        english: "anglais",
        spanish: "espagnol",
        french: "français",
        german: "allemand",
        italian: "italien",
        portuguese: "portugais",
        dutch: "néerlandais",
        polish: "polonais",
      },
      empty: {
        title: "Aucun message",
        description: "Vos conversations apparaîtront ici",
        noMessagesYet: "Aucun message pour le moment. Commencez la conversation.",
      },
      error: {
        send: "Échec de l'envoi du message. Réessayez.",
      },
      inline: {
        download: "Télécharger",
        downloadLabel: "Télécharger le bordereau",
      },
    },
    
    // Notifications
    notifications: {
      title: "Notifications",
      favoritesOnly: "Favoris uniquement",
      markAllRead: "Tout marquer comme lu",
      empty: {
        title: "Aucune notification",
        description: "Vous êtes à jour !",
      },
      types: {
        newMessage: "Nouveau message",
        newOffer: "Nouvelle offre",
        offerAccepted: "Offre acceptée",
        offerDeclined: "Offre refusée",
        itemSold: "Article vendu",
        itemShipped: "Article expédié",
        itemDelivered: "Article livré",
        newFavorite: "Nouveau favori",
        priceReduced: "Prix réduit",
      },
    },
    
    // Orders
    orders: {
      title: "Mes commandes",
      nav: {
        myOrders: "Mes commandes",
      },
      tabs: {
        all: "Toutes",
        inProgress: "En cours",
        toProcess: "À traiter",
        toHandIn: "À déposer",
        shipped: "Expédiées",
        finished: "Terminées",
        cancelled: "Annulées",
        sales: "Ventes",
        purchases: "Achats",
      },
      kpi: {
        toProcess: "À traiter",
        toHandIn: "À déposer",
        shipped: "Expédiées",
      },
      status: {
        pending: "En attente",
        paid: "Payé",
        shipped: "Expédié",
        delivered: "Livré",
        cancelled: "Annulé",
        refunded: "Remboursé",
        waiting_label: "En attente du bordereau",
        label_sent: "Bordereau envoyé au vendeur",
        in_transit: "En transit",
        return_initiated: "Retour initié",
        cancelled_buyer: "Annulé par l'acheteur",
        cancelled_seller: "Annulé par le vendeur",
        cancelled_system: "Annulé",
      },
      action: {
        markProcessed: "Marquer traité",
        downloadLabel: "Télécharger le bordereau",
        undoProcessed: "Annuler \"traité\"",
      },
      bulkLabels: {
        button: "Télécharger tous les bordereaux",
        tooltip: "Télécharger tous les bordereaux prêts/en attente",
        confirm: {
          title: "Télécharger tous les bordereaux maintenant ?",
          body: "Vous êtes sur le point de télécharger {count} bordereau(x).",
          confirm: "Confirmer",
          cancel: "Annuler",
        },
        toast: {
          success: "Tous les bordereaux ont été téléchargés",
          partial: "Certains bordereaux n'ont pas pu être téléchargés",
        },
      },
      badge: {
        processed: "Traité",
        waitingLabel: "En attente de bordereau",
      },
      menu: {
        viewOnVinted: "Voir sur Vinted",
        viewDetails: "Voir le détail",
      },
      details: {
        title: "Détails de la commande",
        orderNumber: "Commande #",
        date: "Date",
        buyer: "Acheteur",
        seller: "Vendeur",
        item: "Article",
        price: "Prix",
        shipping: "Livraison",
        total: "Total",
        status: "Statut",
        timeline: "Chronologie",
        actions: "Actions",
        openInVinted: "Ouvrir dans Vinted",
        printLabel: "Imprimer l'étiquette",
        contactBuyer: "Contacter l'acheteur",
        contactSeller: "Contacter le vendeur",
      },
      modal: {
        title: "Détails de la commande",
        sku: "SKU",
        salePrice: "Prix de vente",
        netMargin: "Marge nette",
        quantity: "Quantité",
        bundle: {
          no: "Pas un lot",
          yes: "Lot ({count})",
        },
        goToChat: "Aller à la conversation",
      },
      timeline: {
        orderPlaced: "Commande passée",
        paymentReceived: "Paiement reçu",
        preparing: "Préparation de l'envoi",
        shipped: "Expédié",
        inTransit: "En transit",
        delivered: "Livré",
      },
      empty: {
        title: "Aucune commande",
        description: "Vos commandes apparaîtront ici",
        toHandIn: "Aucun colis à déposer.",
      },
      sales: {
        action: {
          downloadLabel: "Télécharger le bordereau",
          downloadLabelTooltip: "Télécharger le bordereau d'expédition",
        },
        toast: {
          labelDownloaded: "Bordereau téléchargé",
        },
      },
      purchases: {
        action: {
          addToStock: "Ajouter au stock",
          addToStockTooltip: "Ajouter cet achat au stock",
        },
        toast: {
          addedToStock: "Produit ajouté au stock",
        },
      },
    },
    
    // Stock Manager
    stock: {
      title: "Gestion du stock",
      addProduct: "Ajouter un produit",
      editProduct: "Modifier le produit",
      deleteProduct: "Supprimer le produit",
      search: "Rechercher par titre ou SKU",
      filter: {
        status: "Statut",
        category: "Catégorie",
        brand: "Marque",
        size: "Taille",
        condition: "État",
        material: "Matière",
        priceRange: "Fourchette de prix",
        updated: "Dernière mise à jour",
      },
      fields: {
        title: "Titre",
        photos: "Photos",
        description: "Description",
        category: "Catégorie",
        brand: "Marque",
        condition: "État",
        material: "Matière",
        color: "Couleur",
        size: "Taille",
        purchaseCost: "Coût d'achat (€)",
        purchaseCostHelper: "Votre coût d'achat (utilisé pour calculer les marges). Non visible par les acheteurs.",
        price: "Prix de vente (€)",
        packageSize: "Taille du colis Vinted",
        notes: "Notes internes",
        sku: "SKU",
        quantity: "Quantité",
      },
      skuMode: {
        auto: "Généré automatiquement",
        manual: "SKU manuel",
      },
      placeholders: {
        title: "ex. Jean Levi's 501 vintage",
        description: "Décrivez l'état de l'article, les dimensions et toutes les caractéristiques spéciales...",
        material: "ex. Coton, Polyester",
        size: "ex. M, W32 L34",
        notes: "Notes privées (non visibles par les acheteurs)",
        selectCategory: "Sélectionner une catégorie",
        selectBrand: "Sélectionner une marque",
        skuManual: "Saisissez votre propre SKU",
      },
      helpers: {
        skuAuto: "SKU généré automatiquement à partir de la date et d'un identifiant aléatoire.",
        skuManual: "Utilisez votre propre codification de stock (ex. étagère ou boîte).",
        photos: "Ajoutez jusqu'à 20 photos. La première photo sera l'image principale.",
        vintedfee: "Frais Vinted : ~5%",
        vintedParcelSize: "Choisissez la taille de colis telle que définie sur Vinted.",
        quantity: "Quantité en stock (utilisée dans les calculs de valeur d'inventaire)",
        notesPrivate: "Ces notes sont pour votre référence uniquement et ne seront pas publiées.",
      },
      buttons: {
        regenerateSKU: "Régénérer le SKU",
        saving: "Enregistrement...",
      },
      modal: {
        addTitle: "Ajouter un produit",
        editTitle: "Modifier le produit",
        addSubtitle: "Ajouter un nouveau produit à votre inventaire",
        editSubtitle: "Modifier les informations du produit",
      },
      conditions: {
        new: "Neuf avec étiquette",
        veryGood: "Très bon état",
        good: "Bon état",
        satisfactory: "Satisfaisant",
      },
      packageSizes: {
        small: "Petit colis",
        medium: "Colis moyen",
        large: "Grand colis",
      },
      summary: {
        totalItems: "Articles au total",
        inventoryValue: "Valeur du stock",
        inventoryValueCost: "Valeur du stock — Coût",
        inventoryValueResale: "Valeur du stock — Prix de vente",
        cost: "Coût",
        resale: "Revente",
        potentialMargin: "Marge potentielle",
      },
      columns: {
        thumbnail: "Vignette",
        photo: "Photo",
        title: "Titre",
        sku: "SKU",
        category: "Catégorie",
        brand: "Marque",
        condition: "État",
        material: "Matière",
        size: "Taille",
        purchaseCost: "Coût d'achat (€)",
        cost: "Coût",
        price: "Prix de vente (€)",
        packageSize: "Taille du colis Vinted",
        quantity: "Quantité",
        updated: "Mis à jour",
        margin: "Marge",
        status: "Statut",
        actions: "Actions",
      },
      status: {
        inStock: "En stock",
        listed: "En ligne",
        sold: "Vendu",
        reserved: "Réservé",
      },
      actions: {
        view: "Voir",
        edit: "Modifier",
        archive: "Archiver",
        publish: "Publier",
        delete: "Supprimer",
        save: "Enregistrer",
        saveDraft: "Enregistrer comme brouillon",
        cancel: "Annuler",
      },
      empty: {
        title: "Aucun produit en stock",
        description: "Ajoutez votre premier produit pour commencer",
        noProductsYet: "Aucun produit en stock pour le moment. Ajoutez votre premier produit.",
      },
      errors: {
        load: "Impossible de charger les produits.",
        purchaseCostPositive: "Le coût d'achat doit être un nombre positif.",
        pricePositive: "Le prix doit être un nombre positif.",
        titleRequired: "Le titre est obligatoire.",
        skuRequired: "Le SKU est obligatoire.",
        skuInvalid: "Le format du SKU est invalide.",
      },
      deleteConfirm: {
        title: "Supprimer le produit",
        description: "Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.",
        confirm: "Supprimer",
        cancel: "Annuler",
      },
    },
    
    // Listings Publisher
    publisher: {
      title: "Publication d'annonces",
      subtitle: "Publiez les produits de votre stock vers vos comptes Vinted.",
      publish: "Publier",
      publishToAccount: "Publier sur le compte",
      selectAccount: "Sélectionner un compte",
      selectProduct: "Sélectionner un produit",
      activeListings: "Annonces actives",
      publishedOn: "Publié le",
      search: "Rechercher par titre, SKU ou ID d'annonce",
      sortBy: "Trier par",
      sortOptions: {
        created: "Créé (plus récent)",
        sync: "Dernière synchro",
        price: "Prix (plus élevé)",
      },
      allStatus: "Tous les statuts",
      status: {
        queued: "En file d'attente",
        posting: "Publication...",
        active: "En ligne",
        failed: "Échec",
        ended: "Terminée",
        paused: "En pause",
        sold: "Vendue",
      },
      columns: {
        thumbnail: "Vignette",
        listing: "Annonce",
        title: "Titre",
        sku: "SKU",
        account: "Compte",
        listingId: "ID annonce",
        published: "Publié",
        created: "Créée le",
        lastSync: "Dernière synchro",
        status: "Statut",
        price: "Prix (€)",
        views: "Vues",
        favorites: "Favoris",
        actions: "Actions",
      },
      actions: {
        pause: "Mettre en pause",
        resume: "Reprendre",
        end: "Terminer l'annonce",
        retry: "Réessayer",
        refresh: "Actualiser",
        viewOnVinted: "Voir sur Vinted",
      },
      empty: {
        title: "Aucune annonce active",
        description: "Publiez votre première annonce pour commencer",
        noListingsYet: "Aucune annonce pour le moment. Publiez depuis votre stock pour créer votre première annonce.",
      },
      form: {
        title: "Publier le produit",
        subtitle: "Choisissez le SKU et le compte, puis publiez ce produit sur Vinted.",
        sku: "SKU",
        selectSKU: "Sélectionner un SKU",
        searchSKU: "Rechercher par SKU ou titre...",
        account: "Compte",
        selectAccount: "Sélectionner un compte",
        priceOverride: "Prix (€)",
        packageSizeOverride: "Taille du colis",
        notes: "Notes (facultatif)",
        notesPlaceholder: "Note interne pour cette annonce...",
        publish: "Publier",
        publishing: "Publication...",
        cancel: "Annuler",
      },
      helpers: {
        priceOverride: "Laissez vide pour utiliser le prix du stock.",
        packageSizeOverride: "Laissez vide pour utiliser la taille de colis du stock.",
      },
      errors: {
        load: "Impossible de charger les annonces.",
        publish: "Échec de la publication de l'annonce. Réessayez.",
        skuRequired: "Le SKU est obligatoire.",
        accountRequired: "Le compte est obligatoire.",
        validPrice: "Veuillez saisir un prix valide.",
      },
      toast: {
        publishSuccess: "Publié sur {account}",
        selectRequired: "Veuillez sélectionner un SKU et un compte",
      },
      dialog: {
        title: "Publier le(s) produit(s)",
        description: "Sélectionnez les comptes pour publier {count} produit(s) sur Vinted",
        selectAccounts: "Sélectionner les comptes",
        selectAll: "Tout sélectionner",
        deselectAll: "Tout désélectionner",
        productsToPublish: "Produits à publier",
        publishingOptions: "Options de publication",
        autoPriceRounding: "Arrondi automatique des prix",
        autoPriceRoundingDesc: "Arrondir les prix à .99 (ex. 45,00 € → 44,99 €)",
        autoTranslate: "Traduction automatique de la description",
        comingSoon: "Bientôt disponible",
        publishingStatus: "État de la publication",
        publishToAccounts: "Publier sur {count} compte(s)",
        closeWhenDone: "Fermer quand terminé",
        statusQueued: "En file d'attente",
        statusPosting: "Publication en cours...",
        statusPosted: "Publié",
        statusFailed: "Échec",
      },
    },
    
    // Account Launcher
    accountLauncher: {
      title: "Lanceur de comptes",
      subtitle: "Lancer et gérer les profils ; démarrer/arrêter les comptes et ouvrir la session.",
      createProfile: "Connecter un nouveau compte",
      
      // Profile card
      profile: {
        openVinted: "Ouvrir interface Vinted",
        connect: "Connecter le profil",
        reconnect: "Reconnecter",
        connected: "Connecté",
        disconnect: "Déconnecter",
        stopVinted: "Arrêter Vinted",
        startVinted: "Démarrer Vinted",
        deleteProfile: "Supprimer le profil",
        
        // Status chips
        statusRunning: "En cours d'exécution",
        statusStopped: "À l'arrêt",
        statusConnected: "Connecté",
        statusDisconnected: "Déconnecté",
        
        // Proxy info
        proxyHost: "Hôte proxy",
        proxyPort: "Port proxy",
        noProxy: "Proxy : —",
      },
      
      // Create/Edit Profile Modal
      modal: {
        createTitle: "Connecter un nouveau compte",
        editTitle: "Modifier le profil",
        
        // Section 1: Credentials
        sectionCredentials: "Identifiants du compte",
        email: "E-mail",
        emailPlaceholder: "nom@exemple.com",
        password: "Mot de passe",
        passwordPlaceholder: "••••••••",
        securityNote: "Stocké de manière sécurisée. Jamais partagé.",
        encryptionNote: "Nous chiffrons les identifiants au repos.",
        appPasswordLink: "Utiliser un mot de passe d'application ?",
        
        // Section 2: Proxy
        sectionProxy: "Proxy",
        proxyHost: "Hôte proxy",
        proxyHostPlaceholder: "proxy.monhote.com",
        proxyPort: "Port proxy",
        proxyPortPlaceholder: "8080",
        proxyUser: "Utilisateur proxy",
        proxyUserPlaceholder: "nomutilisateur",
        proxyPassword: "Mot de passe proxy",
        proxyPasswordPlaceholder: "••••••••",
        
        // Section 3: Interface (ex-VNC)
        sectionInterface: "Interface",
        interfacePassword: "Mot de passe de l'interface",
        interfacePasswordPlaceholder: "••••••••",
        interfaceHelperText: "Utilisé pour sécuriser l'accès à l'interface du compte.",
        
        // Section 4: Profile name
        sectionProfileName: "Nom du profil",
        profileName: "Nom du profil",
        profileNamePlaceholder: "Boutique Alice",
        
        // Actions
        save: "Enregistrer le profil",
        saving: "Enregistrement...",
        cancel: "Annuler",
      },
      
      // Tip callout
      tip: {
        title: "Astuce :",
        text: "Lancer un compte ouvre la session d'activité Vinted dans une nouvelle vue web, vous permettant de surveiller et gérer le compte automatiquement.",
      },
      
      // Toasts
      toast: {
        profileCreated: "Profil créé avec succès",
        profileUpdated: "Profil mis à jour avec succès",
        profileDeleted: "Profil supprimé",
        sessionStarted: "Session démarrée",
        sessionStopped: "Session arrêtée",
        connected: "Profil connecté",
        disconnected: "Profil déconnecté",
      },
      
      // Delete confirmation
      deleteConfirm: {
        title: "Supprimer le profil ?",
        message: "Ceci supprimera définitivement le profil et toutes ses données. Cette action ne peut pas être annulée.",
        confirm: "Supprimer",
        cancel: "Annuler",
      },
    },
    
    // Published Listings
    published: {
      title: "Annonces publiées",
      accountSelect: {
        placeholder: "Sélectionnez un compte",
      },
      tabs: {
        active: "Actifs",
        sold: "Vendus",
      },
      search: {
        placeholder: "Rechercher par titre ou SKU",
      },
      sort: {
        label: "Trier",
        newest: "Plus récentes",
        views: "Plus vues",
        favorites: "Plus de favoris",
        hidden: "Masquées",
        boostActive: "Boost actif",
      },
      button: {
        boost: "Booster",
        repost: "Reposter",
      },
      status: {
        active: "Active",
        boostActive: "Boost actif",
        hidden: "Masquée",
        needsRepost: "À republier",
        lowPhotos: "Photos insuffisantes",
        sold: "Vendue",
      },
      action: {
        viewOnVinted: "Voir sur Vinted",
        copyLink: "Copier le lien",
        hide: "Masquer l'annonce",
        delete: "Supprimer l'annonce",
        saveChanges: "Enregistrer",
      },
      drawer: {
        tab: {
          details: "Détails",
          analytics: "Statistiques",
          recommendations: "Recommandations",
        },
        postedDaysAgo: "Publié il y a {count} jour",
        postedDaysAgo_plural: "Publié il y a {count} jours",
      },
      analytics: {
        views: "Vues",
        favorites: "Favoris",
        offers: "Offres",
        avgOffer: "Offre moyenne",
        bestOffer: "Meilleure offre",
        lowestOffer: "Offre la plus basse",
        viewsOverTime: "Vues dans le temps",
        favoritesOverTime: "Favoris dans le temps",
        offersPerDay: "Offres par jour",
        last7Days: "7 derniers jours",
        last30Days: "30 derniers jours",
        last90Days: "90 derniers jours",
        noData: "Aucune donnée disponible",
        trend: "vs période précédente",
      },
      insight: {
        severity: {
          info: "Info",
          warning: "Attention",
          critical: "Critique",
        },
        photos: {
          title: "Ajoutez plus de photos",
          description: "Les annonces avec 5+ photos obtiennent {percent}% de vues en plus",
          cta: "Modifier les photos",
        },
        oldListing: {
          title: "Annonce ancienne",
          description: "Cette annonce a plus de {days} jours. Republiez-la pour remonter dans le feed.",
          cta: "Reposter maintenant",
        },
        lowEngagement: {
          title: "Engagement faible",
          description: "Envisagez de baisser le prix de 5–10% ou d'améliorer la première photo.",
          cta: "Modifier l'annonce",
        },
        offersLow: {
          title: "Offres en dessous du prix",
          description: "Les offres sont {percent}% inférieures au prix. Ajustez le prix ou la description.",
          cta: "Ajuster le prix",
        },
        missingBrand: {
          title: "Marque manquante",
          description: "Ajouter une marque augmente la confiance et la visibilité.",
          cta: "Ajouter une marque",
        },
        shortDescription: {
          title: "Description trop courte",
          description: "Les descriptions détaillées obtiennent {percent}% de favoris en plus.",
          cta: "Améliorer la description",
        },
        hidden: {
          title: "Annonce masquée",
          description: "Affichez cette annonce pour retrouver sa visibilité et attirer des acheteurs.",
          cta: "Afficher l'annonce",
        },
        boostActive: {
          title: "Boost actif",
          description: "Votre annonce est actuellement boostée et restera active jusqu'au {date}.",
          cta: "Voir les statistiques",
        },
      },
      toast: {
        boosted: "Annonce boostée",
        reposted: "Annonce republiée avec succès",
        linkCopied: "Lien copié dans le presse-papier",
        saved: "Modifications enregistrées",
        hidden: "Annonce masquée",
        deleted: "Annonce supprimée",
      },
      modal: {
        repost: {
          title: "Reposter cette annonce ?",
          description: "La republication aide l'annonce à remonter dans le feed.",
          confirm: "Reposter",
          cancel: "Annuler",
        },
      },
      empty: {
        selectAccount: "Sélectionnez un compte pour voir ses annonces.",
        noListings: "Aucune annonce pour ce compte.",
      },
      backToListings: "Retour aux annonces",
      stats: {
        views: "vues",
        favorites: "favoris",
        offers: "offres",
      },
      dialog: {
        boost: {
          title: "Booster cette annonce ?",
          description: "Le boost augmentera la visibilité de votre annonce.",
          confirm: "Booster",
          cancel: "Annuler",
        },
      },
    },
    
    // Wallet
    wallet: {
      title: "Portemonnaie",
      subtitle: "Suivez vos gains, retraits et ventes finalisées par compte.",
      kpi: {
        available: "Disponible pour retrait",
        pending: "Montant en attente",
        updatedRealtime: "Mis à jour en temps réel",
        awaitingRelease: "En attente de libération",
      },
      button: {
        transfer: "Transférer",
      },
      modal: {
        transfer: {
          title: "Transférer vers votre banque",
          available: "Montant disponible",
          amountLabel: "Montant à transférer",
          confirm: "Confirmer le transfert",
          cancel: "Annuler",
        },
      },
      activity: {
        title: "Activité financière",
        type: {
          sale: "Vente finalisée",
          transfer: "Transfert bancaire",
        },
        status: {
          finalized: "Finalisé",
          completed: "Réalisé",
        },
        goToConversation: "Aller à la conversation",
        noActivity: "Aucune activité financière pour le moment",
      },
      toast: {
        transferSuccess: "Transfert initié avec succès",
        transferError: "Échec du transfert. Veuillez réessayer.",
      },
    },
    
    // Settings
    settings: {
      title: "Paramètres",
      profile: "Profil",
      security: "Sécurité",
      preferences: "Préférences",
      subscription: "Abonnement",
      username: "Nom d'utilisateur",
      email: "Adresse e-mail",
      save: "Enregistrer",
      cancel: "Annuler",
      currentPassword: "Mot de passe actuel",
      newPassword: "Nouveau mot de passe",
      confirmPassword: "Confirmer le mot de passe",
      updatePassword: "Mettre à jour le mot de passe",
      language: "Langue",
      theme: "Thème",
      light: "Clair",
      dark: "Sombre",
      system: "Système",
      english: "English",
      french: "Français",
      notifications: {
        title: "Notifications",
        email: "Notifications par e-mail",
        push: "Notifications push",
        newMessages: "Nouveaux messages",
        newOffers: "Nouvelles offres",
        orderUpdates: "Mises à jour des commandes",
        favorites: "Favoris",
      },
    },
    
    // Subscription
    subscription: {
      currentPlan: "Forfait actuel",
      planName: "Forfait",
      price: "Prix",
      nextBilling: "Prochaine facturation",
      status: "Statut",
      active: "Actif",
      trial: "Essai",
      pastDue: "En retard",
      canceled: "Annulé",
      features: "Fonctionnalités incluses",
      changePlan: "Changer de forfait",
      selectPlan: "Sélectionner un forfait",
      updatePlan: "Mettre à jour le forfait",
      planChangeImmediate: "Votre forfait changera immédiatement",
      planChangeNextCycle: "Votre forfait changera au prochain cycle de facturation",
      paymentMethod: "Moyen de paiement",
      noPaymentMethod: "Aucun moyen de paiement enregistré",
      updatePaymentMethod: "Mettre à jour le moyen de paiement",
      billingHistory: "Historique de facturation",
      viewBillingHistory: "Voir l'historique",
      cancelSubscription: "Annuler l'abonnement",
      cancelAnytime: "Vous pouvez annuler votre abonnement à tout moment",
      confirmCancel: "Êtes-vous sûr de vouloir annuler ?",
      cancelReason: "Raison de l'annulation",
      confirmCancellation: "Confirmer l'annulation",
      keepSubscription: "Garder l'abonnement",
      invoiceNumber: "Facture #",
      date: "Date",
      amount: "Montant",
      paid: "Payé",
      refunded: "Remboursé",
      failed: "Échoué",
      download: "Télécharger",
      starter: "Starter",
      pro: "Pro",
      scale: "Scale",
      perMonth: "/mois",
      mostPopular: "Plus populaire",
      currentPlanBadge: "Abonnement actuel",
      choosePlan: "Choisir ce plan",
      // Plan features
      multiAccount: "Multi-comptes",
      upToAccounts: "Jusqu'à {count} comptes connectés",
      performanceDashboard: "Dashboard des performances (CA, ventes, taux de marge, etc.)",
      messagesNotifications: "Messages & notifications centralisés",
      ordersManagement: "Gestion des commandes",
      stockManager: "Gestionnaire de stock (SKU, état, coût, emplacement)",
      autoPublishing: "Publication automatique",
      autoPublishingLimit: "Publication automatique : jusqu'à {count} annonces",
      autoPublishingUnlimited: "Publication automatique : illimité",
      autoOffers: "Offre automatique",
      autoOffersLimit: "Offre automatique : jusqu'à {count} offres",
      autoOffersUnlimited: "Offre automatique : illimité",
      support247: "Support 7/7j",
      responseRate: "Dashboard des performances (CA, ventes, taux de réponse)",
    },
    
    // Filters
    filters: {
      search: "Rechercher...",
      refresh: "Actualiser",
      accounts: {
        all: "Tous les comptes",
        selected: "Sélectionné(s) ({count})",
        title: "Filtrer par compte",
        selectAll: "Tout sélectionner",
        clear: "Effacer",
        noAccounts: "Aucun compte",
      },
    },
    
    // Common
    common: {
      search: "Rechercher",
      filter: "Filtrer",
      sort: "Trier",
      all: "Tous",
      accounts: "Comptes",
      account: "Compte",
      selectedAccounts: "Comptes sélectionnés",
      allAccounts: "Tous les comptes",
      loading: "Chargement...",
      error: "Erreur",
      retry: "Réessayer",
      delete: "Supprimer",
      edit: "Modifier",
      view: "Voir",
      save: "Enregistrer",
      cancel: "Annuler",
      close: "Fermer",
      confirm: "Confirmer",
      back: "Retour",
      next: "Suivant",
      previous: "Précédent",
      export: "Exporter",
      import: "Importer",
      download: "Télécharger",
      upload: "Téléverser",
      actions: "Actions",
      noResults: "Aucun résultat",
      showMore: "Afficher plus",
      showLess: "Afficher moins",
      selectAll: "Tout sélectionner",
      deselectAll: "Tout désélectionner",
      refreshData: "Actualiser les données",
      newest: "Plus récent",
      oldest: "Plus ancien",
      priceAsc: "Prix : croissant",
      priceDesc: "Prix : décroissant",
    },
    
    // Connect Account
    connect: {
      title: "Créer un profil",
      description: "Connectez votre compte Vinted et paramètres proxy/VNC optionnels. Vous pourrez les modifier plus tard.",
      connectButton: "Connecter un compte Vinted",
      connectedAccounts: "Profils connectés",
      connectedProfiles: "Profils connectés",
      addAnother: "Ajouter un autre compte",
      createNewProfile: "Créer un nouveau profil",
      createProfile: "Créer le profil",
      creatingProfile: "Création du profil...",
      profileCreatedSuccess: "Profil cré�� avec succès !",
      account: "Compte",
      email: "E-mail",
      emailPlaceholder: "nom@exemple.com",
      password: "Mot de passe",
      passwordPlaceholder: "••••••••",
      proxyVnc: "Proxy & VNC (optionnel)",
      proxyHost: "Hôte proxy",
      proxyHostPlaceholder: "proxy.monhote.com",
      proxyPort: "Port proxy",
      proxyPortPlaceholder: "8080",
      proxyUser: "Utilisateur proxy",
      proxyUserPlaceholder: "nom d'utilisateur",
      proxyPassword: "Mot de passe proxy",
      vncPassword: "Mot de passe VNC",
      passwordStrength: {
        weak: "Faible",
        medium: "Moyen",
        strong: "Fort",
      },
      securityNote: "Stocké de manière sécurisée. Jamais partagé.",
      useAppPassword: "Utiliser un mot de passe d'application ?",
      encryptionNote: "Nous chiffrons les identifiants au repos.",
      proxyInfo: "Proxies HTTP/SOCKS pris en charge. Laissez vide si vous n'utilisez pas de proxy. Le mot de passe VNC sécurise les sessions distantes.",
      credentialsNote: "Les identifiants sont utilisés uniquement pour ce profil.",
      validation: {
        emailRequired: "L'e-mail est requis",
        emailInvalid: "Veuillez saisir une adresse e-mail valide",
        passwordRequired: "Le mot de passe est requis",
        passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères",
        portInvalid: "Le port doit être entre 1 et 65535",
      },
      empty: {
        title: "Aucun profil pour le moment",
        description: "Créez votre premier profil pour commencer.",
      },
    },
    
    // Account Launcher
    launcher: {
      title: "Lanceur de comptes",
      description: "Démarrer/arrêter chaque compte ; le lancement ouvre l'activité du compte dans une vue web.",
      openInVinted: "Ouvrir dans Vinted",
      launch: "Lancer",
      stop: "Arrêter",
      running: "En cours d'exécution",
      stopped: "À l'arrêt",
      launchedSuccess: "{name} lancé avec succès",
      stoppedSuccess: "{name} arrêté",
      tip: "💡 Astuce :",
      tipDescription: "Lancer un compte ouvre la session d'activité Vinted dans une nouvelle vue web, vous permettant de surveiller et gérer le compte automatiquement.",
      empty: {
        title: "Aucun compte connecté",
        description: "Connectez d'abord un compte Vinted pour commencer à lancer des comptes.",
      },
    },
    
    // Toasts
    toast: {
      success: "Succès",
      error: "Erreur",
      warning: "Avertissement",
      info: "Info",
      languageChanged: "Langue changée en Français",
      themeChanged: "Thème changé en {theme}",
      profileUpdated: "Profil mis à jour avec succès",
      passwordUpdated: "Mot de passe mis à jour avec succès",
      planUpdated: "Forfait mis à jour avec succès",
      subscriptionCanceled: "Abonnement annulé. Renouvellement désactivé.",
      productAdded: "Produit ajouté avec succès",
      productUpdated: "Produit mis à jour avec succès",
      productDeleted: "Produit supprimé avec succès",
      listingPublished: "Annonce publiée avec succès",
      offerSent: "Offre envoyée avec succès",
    },
    
    // Global Refresh
    globalRefresh: {
      tooltip: "Actualiser tout",
      toastDone: "Toutes les données ont été actualisées",
      toastError: "Certaines données n'ont pas pu être actualisées.",
    },
  },
};

// Helper function to get translation
export function t(lang: Language, key: string, params?: Record<string, string | number>): string {
  const keys = key.split(".");
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  let result = value || key;
  
  // Handle parameter substitution
  if (params && typeof result === "string") {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replace(`{${paramKey}}`, String(paramValue));
    });
  }
  
  return result;
}

// Pluralization helper
export function tp(lang: Language, key: string, count: number, params?: Record<string, string | number>): string {
  const pluralKey = count === 1 ? key : `${key}_plural`;
  return t(lang, pluralKey, { count, ...params });
}

// Get locale from language
export function getLocale(lang: Language): Locale {
  return lang === "fr" ? "fr-FR" : "en-GB";
}

// Currency formatting
export function formatCurrency(value: number, lang: Language): string {
  const locale = getLocale(lang);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Format date with time (e.g., "22 Dec 2025 · 23:28" or "22 déc. 2025 · 23:28")
export function formatDateTime(date: Date, lang: Language): string {
  const locale = getLocale(lang);
  const dateStr = date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dateStr} · ${timeStr}`;
}

// Number formatting
export function formatNumber(value: number, lang: Language, decimals: number = 0): string {
  const locale = getLocale(lang);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Percentage formatting
export function formatPercent(value: number, lang: Language, decimals: number = 1): string {
  const locale = getLocale(lang);
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

// Date formatting
export function formatDate(date: Date | string, lang: Language, options?: Intl.DateTimeFormatOptions): string {
  const locale = getLocale(lang);
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  
  return new Intl.DateTimeFormat(locale, options || defaultOptions).format(dateObj);
}

// Relative time formatting (e.g., "2 hours ago")
export function formatRelativeTime(date: Date | string, lang: Language): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  
  if (diffMins < 1) {
    return t(lang, "messages.time.justNow");
  } else if (diffMins < 60) {
    return tp(lang, "messages.time.minutesAgo", diffMins);
  } else if (diffHours < 24) {
    return tp(lang, "messages.time.hoursAgo", diffHours);
  } else if (diffDays < 7) {
    return tp(lang, "messages.time.daysAgo", diffDays);
  } else {
    return tp(lang, "messages.time.weeksAgo", diffWeeks);
  }
}

// Compact number formatting (e.g., 1.2K, 3.5M)
export function formatCompactNumber(value: number, lang: Language): string {
  const locale = getLocale(lang);
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}
