"""
Free Cash Flow to Equity (FCFE) valuation model.
Discounts cash flows available to equity holders using Cost of Equity (Ke).

FCFE = Net Income + D&A - CapEx - ΔNWC + Net Borrowing
Equity Value = Σ PV(FCFE) + PV(Terminal Value)
"""


class FCFEModel:
    """Build and calculate FCFE-based equity valuation models."""

    def __init__(self, company_name="Company"):
        self.company_name = company_name
        self.historical = {}
        self.assumptions = {}
        self.ke_components = {}
        self.projections = {}
        self.valuation = {}

    def set_historical(self, years, net_income, depreciation, capex, nwc,
                       net_borrowing=None, dividends=None):
        """
        Set historical financial data.

        Args:
            years: List of historical years
            net_income: Net income after tax
            depreciation: Depreciation & amortization
            capex: Capital expenditure (positive values)
            nwc: Net working capital each year
            net_borrowing: Net new debt issued minus repaid (default 0)
            dividends: Historical dividends paid (for payout ratio calc)
        """
        n = len(years)
        if net_borrowing is None:
            net_borrowing = [0] * n
        if dividends is None:
            dividends = [0] * n

        # Calculate historical FCFE
        fcfe_hist = []
        for i in range(n):
            if i == 0:
                nwc_change = 0
            else:
                nwc_change = nwc[i] - nwc[i - 1]
            fcfe = net_income[i] + depreciation[i] - capex[i] - nwc_change + net_borrowing[i]
            fcfe_hist.append(fcfe)

        self.historical = {
            "years": years,
            "net_income": net_income,
            "depreciation": depreciation,
            "capex": capex,
            "nwc": nwc,
            "net_borrowing": net_borrowing,
            "dividends": dividends,
            "fcfe": fcfe_hist,
            "payout_ratio": [dividends[i] / net_income[i] if net_income[i] != 0 else 0
                             for i in range(n)],
        }

    def set_assumptions(self, projection_years=5, net_income_growth=None,
                        depr_percent_rev=None, capex_percent_rev=None,
                        nwc_percent_rev=None, net_borrowing_growth=None,
                        terminal_growth=0.03, base_revenue=None,
                        revenue_growth=None):
        """
        Set projection assumptions.

        Args:
            projection_years: Number of years to project
            net_income_growth: Annual NI growth rates
            depr_percent_rev: Depreciation as % of revenue
            capex_percent_rev: CapEx as % of revenue
            nwc_percent_rev: NWC as % of revenue
            net_borrowing_growth: Net borrowing growth rates
            terminal_growth: Perpetual growth rate
            base_revenue: Last year revenue for projections
            revenue_growth: Revenue growth per year
        """
        n = projection_years

        if net_income_growth is None:
            net_income_growth = [0.05] * n
        if revenue_growth is None:
            revenue_growth = [0.05] * n
        if depr_percent_rev is None:
            depr_percent_rev = [0.02] * n
        if capex_percent_rev is None:
            capex_percent_rev = [0.02] * n
        if nwc_percent_rev is None:
            nwc_percent_rev = [0.10] * n
        if net_borrowing_growth is None:
            net_borrowing_growth = [0] * n

        self.assumptions = {
            "projection_years": n,
            "net_income_growth": net_income_growth,
            "revenue_growth": revenue_growth,
            "depr_percent_rev": depr_percent_rev,
            "capex_percent_rev": capex_percent_rev,
            "nwc_percent_rev": nwc_percent_rev,
            "net_borrowing_growth": net_borrowing_growth,
            "terminal_growth": terminal_growth,
            "base_revenue": base_revenue or (self.historical.get("net_income", [1000])[-1] / 0.2),
        }

    def calculate_ke(self, risk_free_rate, beta, market_premium):
        """
        Calculate Cost of Equity using CAPM.

        Ke = Rf + β × (Rm - Rf)

        Args:
            risk_free_rate: Risk-free rate
            beta: Equity beta
            market_premium: Market risk premium (Rm - Rf)

        Returns:
            Cost of equity as decimal
        """
        ke = risk_free_rate + beta * market_premium
        self.ke_components = {
            "risk_free_rate": risk_free_rate,
            "beta": beta,
            "market_premium": market_premium,
            "ke": ke,
        }
        return ke

    def project_fcfe(self):
        """
        Project future FCFE based on assumptions.

        Returns:
            Dictionary with projected financials
        """
        n = self.assumptions["projection_years"]
        base_ni = self.historical["net_income"][-1]
        base_rev = self.assumptions["base_revenue"]
        prev_nwc = self.historical["nwc"][-1]
        base_nb = self.historical["net_borrowing"][-1] if self.historical["net_borrowing"] else 0

        proj = {
            "year": [],
            "revenue": [],
            "net_income": [],
            "depreciation": [],
            "capex": [],
            "nwc": [],
            "nwc_change": [],
            "net_borrowing": [],
            "fcfe": [],
        }

        prev_ni = base_ni
        prev_rev = base_rev

        for i in range(n):
            # Revenue projection
            rev = prev_rev * (1 + self.assumptions["revenue_growth"][i])

            # Net Income projection
            ni = prev_ni * (1 + self.assumptions["net_income_growth"][i])

            # D&A, CapEx, NWC
            depr = rev * self.assumptions["depr_percent_rev"][i]
            capex = rev * self.assumptions["capex_percent_rev"][i]
            curr_nwc = rev * self.assumptions["nwc_percent_rev"][i]
            nwc_change = curr_nwc - prev_nwc

            # Net Borrowing
            nb = self.assumptions["net_borrowing_growth"][i]

            # FCFE
            fcfe = ni + depr - capex - nwc_change + nb

            proj["year"].append(i + 1)
            proj["revenue"].append(rev)
            proj["net_income"].append(ni)
            proj["depreciation"].append(depr)
            proj["capex"].append(capex)
            proj["nwc"].append(curr_nwc)
            proj["nwc_change"].append(nwc_change)
            proj["net_borrowing"].append(nb)
            proj["fcfe"].append(fcfe)

            prev_ni = ni
            prev_rev = rev
            prev_nwc = curr_nwc

        self.projections = proj
        return proj

    def calculate_equity_value(self, shares_outstanding):
        """
        Calculate equity value by discounting FCFE at Cost of Equity.

        Args:
            shares_outstanding: Number of shares (millions)

        Returns:
            Valuation results dictionary
        """
        if not self.projections:
            self.project_fcfe()

        ke = self.ke_components["ke"]
        g = self.assumptions["terminal_growth"]
        n = self.assumptions["projection_years"]
        fcfe = self.projections["fcfe"]

        # PV of projected FCFE
        pv_fcfe_list = []
        for i, f in enumerate(fcfe):
            pv = f / ((1 + ke) ** (i + 1))
            pv_fcfe_list.append(pv)

        total_pv_fcfe = sum(pv_fcfe_list)

        # Terminal value (Gordon Growth on FCFE)
        if ke <= g:
            terminal_value = 0
            pv_terminal = 0
        else:
            terminal_fcfe = fcfe[-1] * (1 + g)
            terminal_value = terminal_fcfe / (ke - g)
            pv_terminal = terminal_value / ((1 + ke) ** n)

        # Equity value (directly — no need to subtract debt)
        equity_value = total_pv_fcfe + pv_terminal
        value_per_share = equity_value / shares_outstanding if shares_outstanding > 0 else 0

        self.valuation = {
            "equity_value": equity_value,
            "pv_fcfe": total_pv_fcfe,
            "pv_terminal": pv_terminal,
            "terminal_value": terminal_value,
            "terminal_pct": (pv_terminal / equity_value * 100) if equity_value > 0 else 0,
            "shares": shares_outstanding,
            "value_per_share": value_per_share,
            "pv_fcfe_detail": pv_fcfe_list,
        }
        return self.valuation

    def sensitivity_analysis(self, ke_range, g_range, shares_outstanding):
        """
        Two-way sensitivity: Ke vs Terminal Growth.

        Args:
            ke_range: List of Ke values to test
            g_range: List of terminal growth values to test
            shares_outstanding: Shares outstanding

        Returns:
            2D list of target prices
        """
        original_ke = self.ke_components["ke"]
        original_g = self.assumptions["terminal_growth"]

        results = []
        for ke_val in ke_range:
            row = []
            for g_val in g_range:
                self.ke_components["ke"] = ke_val
                self.assumptions["terminal_growth"] = g_val
                self.project_fcfe()
                val = self.calculate_equity_value(shares_outstanding)
                row.append(val["value_per_share"])
            results.append(row)

        # Restore
        self.ke_components["ke"] = original_ke
        self.assumptions["terminal_growth"] = original_g
        self.project_fcfe()

        return results

    def generate_summary(self):
        """Generate formatted valuation summary."""
        if not self.valuation:
            return "No valuation results. Run calculate_equity_value first."

        lines = [
            f"FCFE Valuation Summary - {self.company_name}",
            "=" * 55,
            "",
            "Key Assumptions:",
            f"  Projection Period: {self.assumptions['projection_years']} years",
            f"  NI Growth: {self.assumptions['net_income_growth'][0] * 100:.1f}%/year",
            f"  Terminal Growth: {self.assumptions['terminal_growth'] * 100:.1f}%",
            f"  Cost of Equity (Ke): {self.ke_components['ke'] * 100:.1f}%",
            f"    Rf = {self.ke_components['risk_free_rate'] * 100:.1f}%",
            f"    Beta = {self.ke_components['beta']:.2f}",
            f"    Market Premium = {self.ke_components['market_premium'] * 100:.1f}%",
            "",
            "Valuation Results:",
            f"  PV of FCFE: {self.valuation['pv_fcfe']:,.0f}",
            f"  PV of Terminal: {self.valuation['pv_terminal']:,.0f}",
            f"  Terminal % of Value: {self.valuation['terminal_pct']:.1f}%",
            f"  Equity Value: {self.valuation['equity_value']:,.0f}",
            f"  Shares Outstanding: {self.valuation['shares']:.2f}M",
            f"  Value per Share: {self.valuation['value_per_share']:,.0f}",
            "",
        ]
        return "\n".join(lines)


# Example usage
if __name__ == "__main__":
    model = FCFEModel("Example Corp")

    model.set_historical(
        years=[2022, 2023, 2024],
        net_income=[200, 250, 300],
        depreciation=[50, 55, 60],
        capex=[70, 75, 80],
        nwc=[100, 110, 120],
        net_borrowing=[0, 0, 0],
        dividends=[100, 125, 150],
    )

    model.set_assumptions(
        projection_years=5,
        net_income_growth=[0.08] * 5,
        revenue_growth=[0.08] * 5,
        depr_percent_rev=[0.03] * 5,
        capex_percent_rev=[0.04] * 5,
        nwc_percent_rev=[0.08] * 5,
        terminal_growth=0.03,
        base_revenue=3000,
    )

    model.calculate_ke(risk_free_rate=0.04, beta=1.0, market_premium=0.07)
    model.project_fcfe()
    model.calculate_equity_value(shares_outstanding=100)
    print(model.generate_summary())
