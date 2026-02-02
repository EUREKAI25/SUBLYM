datas_tests = {
    "contracts": {
        "subscription": {
            "start": {"price": {"month": 19, "year": 259}},
            "medium": {"price": {"month": 29, "year": 319}},
            "premium": {"price": {"month": 45, "year": 530}},
        }
    },
   "userdatas": {
    "civil": {
        "pseudo": "pseudo",
        "email": "nathalie.brigitte.com",
        "tel": "+33660474292",
        "dnaiss": "23101974",
        "gender": "f",
        "status": "active",  # "inactive" | "banned" | "duepay"
        "register_date": "01012000",
    },
    "profile": {
        "style": "élégant, dandy",
        "world": "art",
    },
},

    "formdatas": {
        "dream": "Je rêve de présenter un tedX devant 500 personnes",
        "userphotolist": [
            # Chemins relatifs ou via variable d'env SUBLYM_TEST_PHOTOS_DIR
            "photos/IMG_2867.jpeg",
            "photos/IMG_2883.jpeg",
            "photos/IMG_2913.jpeg",
        ],
        "reject": ["Je ne veux pas être habillée en robe"],
    },
}
