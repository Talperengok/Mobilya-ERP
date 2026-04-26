from app.models.ledger import AccountType

CHART_OF_ACCOUNTS = {
    "1000": {"name": "Cash / Bank", "type": AccountType.ASSET},
    "1100": {"name": "Accounts Receivable", "type": AccountType.ASSET},
    "1200": {"name": "Inventory (Raw Material)", "type": AccountType.ASSET},
    "1300": {"name": "Inventory (Finished Goods)", "type": AccountType.ASSET},
    "2100": {"name": "Accounts Payable", "type": AccountType.LIABILITY},
    "2200": {"name": "VAT Payable/Receivable", "type": AccountType.LIABILITY}, # Kept simple for VAT
    "4000": {"name": "Sales Revenue", "type": AccountType.REVENUE},
    "5000": {"name": "Cost of Goods Sold (COGS)", "type": AccountType.EXPENSE},
    "5100": {"name": "Raw Material Purchases", "type": AccountType.EXPENSE},
    "5200": {"name": "RMA Refunds", "type": AccountType.EXPENSE},
}

def get_account_info(code: str) -> dict:
    if code not in CHART_OF_ACCOUNTS:
        raise ValueError(f"Invalid account code: {code}")
    return CHART_OF_ACCOUNTS[code]
