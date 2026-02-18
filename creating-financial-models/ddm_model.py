"""
Dividend Discount Model (DDM) module.
Implements multiple DDM variants for equity valuation:
  1. Gordon Growth Model (single-stage, constant growth)
  2. Two-Stage DDM (high growth then stable growth)
  3. H-Model (linearly declining growth)
"""


class DDMModel:
    """Dividend Discount Model for equity valuation."""

    def __init__(self, company_name="Company"):
        self.company_name = company_name
        self.historical = {}
        self.ke_components = {}
        self.results = {}

    def set_historical_dividends(self, years, dividends_paid, net_income,
                                 shares_outstanding):
        """
        Set historical dividend data.

        Args:
            years: List of historical years
            dividends_paid: Total dividends paid (tỷ VND, positive values)
            net_income: Net income (tỷ VND)
            shares_outstanding: Shares outstanding (millions)
        """
        n = len(years)
        dps = [dividends_paid[i] / shares_outstanding * 1000 if shares_outstanding > 0 else 0
               for i in range(n)]
        payout = [dividends_paid[i] / net_income[i] if net_income[i] != 0 else 0
                  for i in range(n)]

        # Dividend growth rates
        div_growth = []
        for i in range(1, n):
            if dps[i - 1] > 0:
                g = (dps[i] / dps[i - 1]) - 1
            else:
                g = 0
            div_growth.append(g)

        self.historical = {
            "years": years,
            "dividends_paid": dividends_paid,
            "net_income": net_income,
            "shares": shares_outstanding,
            "dps": dps,
            "payout_ratio": payout,
            "avg_payout": sum(payout) / len(payout) if payout else 0,
            "avg_dps": sum(dps) / len(dps) if dps else 0,
            "div_growth": div_growth,
            "avg_div_growth": sum(div_growth) / len(div_growth) if div_growth else 0,
        }

    def calculate_ke(self, risk_free_rate, beta, market_premium):
        """
        Calculate Cost of Equity using CAPM.

        Args:
            risk_free_rate: Risk-free rate
            beta: Equity beta
            market_premium: Market risk premium

        Returns:
            Cost of equity
        """
        ke = risk_free_rate + beta * market_premium
        self.ke_components = {
            "risk_free_rate": risk_free_rate,
            "beta": beta,
            "market_premium": market_premium,
            "ke": ke,
        }
        return ke

    def gordon_growth(self, d0=None, g=None, ke=None):
        """
        Gordon Growth Model (single-stage DDM).
        P₀ = D₁ / (Ke - g) = D₀ × (1 + g) / (Ke - g)

        Best for: mature companies with stable dividend growth.

        Args:
            d0: Last dividend per share (VND). Uses historical if None.
            g: Constant dividend growth rate. Uses historical avg if None.
            ke: Cost of equity. Uses calculated Ke if None.

        Returns:
            Dict with valuation results
        """
        if d0 is None:
            d0 = self.historical["dps"][-1] if self.historical.get("dps") else 0
        if g is None:
            g = self.historical.get("avg_div_growth", 0.03)
        if ke is None:
            ke = self.ke_components.get("ke", 0.10)

        if ke <= g:
            return {
                "method": "Gordon Growth Model",
                "error": f"Ke ({ke:.1%}) must be > g ({g:.1%})",
            }

        d1 = d0 * (1 + g)
        price = d1 / (ke - g)

        result = {
            "method": "Gordon Growth Model",
            "d0": d0,
            "d1": d1,
            "growth_rate": g,
            "ke": ke,
            "target_price": price,
            "dividend_yield": d1 / price * 100 if price > 0 else 0,
        }

        self.results["gordon"] = result
        return result

    def two_stage_ddm(self, d0=None, g_high=None, g_stable=None,
                      high_growth_years=5, ke=None):
        """
        Two-Stage DDM.
        Stage 1: high dividend growth for n years
        Stage 2: stable growth forever (Gordon Growth)

        P₀ = Σ D_t / (1+Ke)^t + P_n / (1+Ke)^n
        where P_n = D_{n+1} / (Ke - g_stable)

        Args:
            d0: Last DPS (VND)
            g_high: High growth rate for stage 1
            g_stable: Stable growth rate for stage 2
            high_growth_years: Number of high growth years
            ke: Cost of equity

        Returns:
            Dict with valuation results
        """
        if d0 is None:
            d0 = self.historical["dps"][-1] if self.historical.get("dps") else 0
        if g_high is None:
            g_high = max(self.historical.get("avg_div_growth", 0.08), 0.05)
        if g_stable is None:
            g_stable = 0.03
        if ke is None:
            ke = self.ke_components.get("ke", 0.10)

        if ke <= g_stable:
            return {
                "method": "Two-Stage DDM",
                "error": f"Ke ({ke:.1%}) must be > g_stable ({g_stable:.1%})",
            }

        # Stage 1: PV of high-growth dividends
        pv_stage1 = 0
        stage1_dividends = []
        d_t = d0
        for t in range(1, high_growth_years + 1):
            d_t = d_t * (1 + g_high)
            pv = d_t / ((1 + ke) ** t)
            pv_stage1 += pv
            stage1_dividends.append({"year": t, "dividend": d_t, "pv": pv})

        # Stage 2: Terminal value at end of stage 1
        d_terminal = d_t * (1 + g_stable)
        terminal_price = d_terminal / (ke - g_stable)
        pv_terminal = terminal_price / ((1 + ke) ** high_growth_years)

        # Total price
        price = pv_stage1 + pv_terminal

        result = {
            "method": "Two-Stage DDM",
            "d0": d0,
            "g_high": g_high,
            "g_stable": g_stable,
            "high_growth_years": high_growth_years,
            "ke": ke,
            "pv_stage1": pv_stage1,
            "pv_terminal": pv_terminal,
            "terminal_price": terminal_price,
            "terminal_pct": pv_terminal / price * 100 if price > 0 else 0,
            "target_price": price,
            "stage1_dividends": stage1_dividends,
        }

        self.results["two_stage"] = result
        return result

    def h_model(self, d0=None, g_high=None, g_stable=None,
                half_life_years=5, ke=None):
        """
        H-Model: Growth declines linearly from g_high to g_stable.

        P₀ = D₀ × (1 + g_stable) / (Ke - g_stable)
             + D₀ × H × (g_high - g_stable) / (Ke - g_stable)
        where H = half_life_years / 2

        Args:
            d0: Last DPS (VND)
            g_high: Initial high growth rate
            g_stable: Long-term stable growth rate
            half_life_years: Half-life of growth decline
            ke: Cost of equity

        Returns:
            Dict with valuation results
        """
        if d0 is None:
            d0 = self.historical["dps"][-1] if self.historical.get("dps") else 0
        if g_high is None:
            g_high = max(self.historical.get("avg_div_growth", 0.08), 0.05)
        if g_stable is None:
            g_stable = 0.03
        if ke is None:
            ke = self.ke_components.get("ke", 0.10)

        if ke <= g_stable:
            return {
                "method": "H-Model",
                "error": f"Ke ({ke:.1%}) must be > g_stable ({g_stable:.1%})",
            }

        h = half_life_years / 2

        # Stable growth component
        stable_value = d0 * (1 + g_stable) / (ke - g_stable)

        # Extra growth component
        extra_value = d0 * h * (g_high - g_stable) / (ke - g_stable)

        price = stable_value + extra_value

        result = {
            "method": "H-Model",
            "d0": d0,
            "g_high": g_high,
            "g_stable": g_stable,
            "half_life_years": half_life_years,
            "h": h,
            "ke": ke,
            "stable_component": stable_value,
            "extra_growth_component": extra_value,
            "target_price": price,
        }

        self.results["h_model"] = result
        return result

    def run_all(self, d0=None, g_high=None, g_stable=None, ke=None):
        """
        Run all DDM variants.

        Returns:
            Summary dict with all results
        """
        gordon = self.gordon_growth(d0=d0, g=g_stable, ke=ke)
        two_stage = self.two_stage_ddm(d0=d0, g_high=g_high, g_stable=g_stable, ke=ke)
        h_model = self.h_model(d0=d0, g_high=g_high, g_stable=g_stable, ke=ke)

        prices = []
        for r in [gordon, two_stage, h_model]:
            if "target_price" in r and r["target_price"] > 0:
                prices.append(r["target_price"])

        summary = {
            "gordon": gordon,
            "two_stage": two_stage,
            "h_model": h_model,
        }
        if prices:
            summary["fair_value_low"] = min(prices)
            summary["fair_value_high"] = max(prices)
            summary["fair_value_avg"] = sum(prices) / len(prices)

        self.results = summary
        return summary

    def sensitivity_gordon(self, d0, ke_range, g_range):
        """
        Sensitivity analysis for Gordon Growth: Ke vs g.

        Returns:
            2D list of target prices
        """
        results = []
        for ke_val in ke_range:
            row = []
            for g_val in g_range:
                if ke_val <= g_val:
                    row.append(None)
                else:
                    d1 = d0 * (1 + g_val)
                    price = d1 / (ke_val - g_val)
                    row.append(price)
            results.append(row)
        return results

    def generate_summary(self):
        """Generate formatted DDM valuation summary."""
        if not self.results:
            return "No results. Run valuation methods first."

        lines = [
            f"Dividend Discount Model Summary - {self.company_name}",
            "=" * 60,
            "",
        ]

        # Historical info
        if self.historical:
            lines.append("Historical Dividend Data:")
            for i, yr in enumerate(self.historical["years"]):
                dps = self.historical["dps"][i]
                payout = self.historical["payout_ratio"][i]
                lines.append(f"  {yr}: DPS = {dps:,.0f} VND, Payout = {payout:.0%}")
            lines.append(f"  Average Payout Ratio: {self.historical['avg_payout']:.0%}")
            lines.append(f"  Average DPS Growth: {self.historical['avg_div_growth']:.1%}")
            lines.append("")

        # Gordon Growth
        if "gordon" in self.results:
            r = self.results["gordon"]
            if "error" not in r:
                lines.append("1. Gordon Growth Model:")
                lines.append(f"   D₀ = {r['d0']:,.0f}, g = {r['growth_rate']:.1%}, Ke = {r['ke']:.1%}")
                lines.append(f"   Target Price = {r['target_price']:,.0f} VND")
                lines.append(f"   Implied Dividend Yield = {r['dividend_yield']:.1f}%")
                lines.append("")

        # Two-Stage
        if "two_stage" in self.results:
            r = self.results["two_stage"]
            if "error" not in r:
                lines.append("2. Two-Stage DDM:")
                lines.append(f"   Stage 1: g = {r['g_high']:.1%} for {r['high_growth_years']} years")
                lines.append(f"   Stage 2: g = {r['g_stable']:.1%} (perpetual)")
                lines.append(f"   Ke = {r['ke']:.1%}")
                lines.append(f"   PV Stage 1: {r['pv_stage1']:,.0f} VND")
                lines.append(f"   PV Terminal: {r['pv_terminal']:,.0f} VND ({r['terminal_pct']:.1f}%)")
                lines.append(f"   Target Price = {r['target_price']:,.0f} VND")
                lines.append("")

        # H-Model
        if "h_model" in self.results:
            r = self.results["h_model"]
            if "error" not in r:
                lines.append("3. H-Model:")
                lines.append(f"   g_high = {r['g_high']:.1%} → g_stable = {r['g_stable']:.1%}")
                lines.append(f"   Half-life = {r['half_life_years']} years, Ke = {r['ke']:.1%}")
                lines.append(f"   Target Price = {r['target_price']:,.0f} VND")
                lines.append("")

        # Fair value range
        if "fair_value_avg" in self.results:
            lines.append("Fair Value Range (DDM):")
            lines.append(f"  Low:  {self.results['fair_value_low']:,.0f} VND")
            lines.append(f"  Avg:  {self.results['fair_value_avg']:,.0f} VND")
            lines.append(f"  High: {self.results['fair_value_high']:,.0f} VND")
            lines.append("")

        return "\n".join(lines)


# Example usage
if __name__ == "__main__":
    model = DDMModel("Example Corp")

    model.set_historical_dividends(
        years=[2021, 2022, 2023, 2024],
        dividends_paid=[100, 120, 140, 160],
        net_income=[200, 250, 300, 350],
        shares_outstanding=100,
    )

    model.calculate_ke(risk_free_rate=0.04, beta=1.0, market_premium=0.07)

    model.run_all(g_high=0.10, g_stable=0.03)
    print(model.generate_summary())
