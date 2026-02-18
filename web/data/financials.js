const FINANCIAL_DATA = {
    "company": "Nhựa Bình Minh (BMP)",
    "years": [2021, 2022, 2023, 2024, 2025],
    "shares_outstanding": 81.86,
    "historical": {
        "revenue": [4553, 5808, 5157, 4616, 5510],
        "ebitda": [459, 1041, 1479, 1352, 1632],
        "capex": [159, 70, 58, 109, 123],
        "nwc": [497, 488, 37, 201, 217],
        "ebt": [268, 871, 1307, 1241, 1539],
        "interest": [0, 0, 0, 0, 0],
        "depr": [191, 170, 172, 111, 93],
        "cash_equivalents": 2057,
        "debt": 0
    },
    "assumptions": {
        "rev_growth": 0.05,
        "ebitda_margin": 0.29,
        "tax_rate": 0.20,
        "wacc": 0.11,
        "terminal_growth": 0.03,
        "capex_pct": 0.022,
        "nwc_pct": 0.04
    },
    // --- Extended Data from Financial Statements ---
    "balance_sheet": {
        "current_assets": [2008, 2215, 2594, 2596, 2758],
        "cash_and_equivalents": [173, 359, 821, 504, 297],
        "short_term_investments": [815, 965, 1190, 1410, 1760],
        "accounts_receivable": [370, 279, 174, 178, 129],
        "inventory": [619, 577, 364, 464, 525],
        "other_current_assets": [32, 36, 44, 41, 47],
        "non_current_assets": [830, 830, 661, 604, 620],
        "total_assets": [2838, 3045, 3255, 3200, 3379],
        "current_liabilities": [523, 403, 546, 481, 484],
        "long_term_liabilities": [22, 20, 19, 18, 18],
        "total_liabilities": [545, 423, 565, 499, 501],
        "shareholders_equity": [2293, 2621, 2690, 2702, 2877]
    },
    "income_statement": {
        "revenue": [4553, 5808, 5157, 4616, 5510],
        "cogs": [3849, 4201, 3041, 2627, 2970],
        "gross_profit": [704, 1608, 2116, 1989, 2540],
        "selling_expenses": [281, 503, 676, 556, 711],
        "admin_expenses": [88, 129, 107, 120, 166],
        "operating_income": [272, 868, 1304, 1229, 1535],
        "ebt": [268, 871, 1307, 1241, 1539],
        "tax_expense": [54, 177, 266, 250, 311],
        "net_income": [214, 694, 1041, 991, 1229],
        "ebitda": [459, 1041, 1479, 1352, 1632],
        "eps": [2619, 8481, 12717, 12103, 15010]
    },
    "cash_flow": {
        "operating": [-31, 799, 1603, 901, 1216],
        "investing": [291, -145, -174, -248, -379],
        "financing": [-283, -469, -966, -970, -1044],
        "dividends": [-285, -467, -966, -969, -1044],
        "net_change": [-23, 186, 463, -317, -207]
    },
    "market_data": {
        "share_price": 92400
    }
};
