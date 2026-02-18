"""
Relative Valuation module.
Implements P/E, P/B, and EV/EBITDA comparable valuation methods.

These methods value a company by comparing its multiples to industry peers
or historical averages.
"""


class RelativeValuation:
    """Perform relative valuation using comparable multiples."""

    def __init__(self, company_name="Company"):
        self.company_name = company_name
        self.financials = {}
        self.peers = {}
        self.results = {}

    def set_financials(self, eps, bvps, ebitda, net_debt, cash,
                       shares_outstanding, current_price=None,
                       net_income=None, book_value=None, revenue=None):
        """
        Set company financial data for valuation.

        Args:
            eps: Earnings per share (VND)
            bvps: Book value per share (VND)
            ebitda: EBITDA (tỷ VND)
            net_debt: Total debt - cash (tỷ VND)
            cash: Cash and equivalents (tỷ VND)
            shares_outstanding: Shares (millions)
            current_price: Current market price (VND, optional for comparison)
            net_income: Net income (tỷ VND, optional)
            book_value: Total equity (tỷ VND, optional)
            revenue: Revenue (tỷ VND, optional)
        """
        self.financials = {
            "eps": eps,
            "bvps": bvps,
            "ebitda": ebitda,
            "net_debt": net_debt,
            "cash": cash,
            "shares": shares_outstanding,
            "current_price": current_price,
            "net_income": net_income,
            "book_value": book_value,
            "revenue": revenue,
        }

        # Calculate current implied multiples if price is provided
        if current_price and eps and eps > 0:
            self.financials["current_pe"] = current_price / eps
        if current_price and bvps and bvps > 0:
            self.financials["current_pb"] = current_price / bvps
        if current_price and ebitda and ebitda > 0:
            ev = current_price * shares_outstanding / 1000 + net_debt
            self.financials["current_ev_ebitda"] = ev / ebitda

    def set_peer_multiples(self, peers):
        """
        Set peer company multiples for comparison.

        Args:
            peers: Dict of peer data, e.g.:
                {
                    "AAA": {"pe": 12, "pb": 2.5, "ev_ebitda": 8},
                    "BBB": {"pe": 15, "pb": 3.0, "ev_ebitda": 10},
                }
        """
        self.peers = peers

    def _peer_avg(self, metric):
        """Calculate average of a metric across peers."""
        values = [p[metric] for p in self.peers.values() if metric in p and p[metric]]
        return sum(values) / len(values) if values else None

    def _peer_median(self, metric):
        """Calculate median of a metric across peers."""
        values = sorted([p[metric] for p in self.peers.values()
                         if metric in p and p[metric]])
        if not values:
            return None
        mid = len(values) // 2
        if len(values) % 2 == 0:
            return (values[mid - 1] + values[mid]) / 2
        return values[mid]

    def valuation_pe(self, target_pe=None, use_median=False):
        """
        P/E Valuation: Target Price = EPS × Target P/E

        Args:
            target_pe: Target P/E ratio (if None, uses peer average)
            use_median: Use median instead of mean for peer P/E

        Returns:
            Dict with valuation results
        """
        eps = self.financials["eps"]
        if eps is None or eps <= 0:
            return {"method": "P/E", "error": "EPS <= 0, cannot apply P/E"}

        if target_pe is None:
            target_pe = self._peer_median("pe") if use_median else self._peer_avg("pe")

        if target_pe is None:
            return {"method": "P/E", "error": "No target P/E available"}

        target_price = eps * target_pe

        result = {
            "method": "P/E",
            "eps": eps,
            "target_pe": target_pe,
            "target_price": target_price,
            "peer_avg_pe": self._peer_avg("pe"),
            "peer_median_pe": self._peer_median("pe"),
        }

        if self.financials.get("current_price"):
            result["current_price"] = self.financials["current_price"]
            result["current_pe"] = self.financials.get("current_pe")
            result["upside_pct"] = (target_price / self.financials["current_price"] - 1) * 100

        self.results["pe"] = result
        return result

    def valuation_pb(self, target_pb=None, use_median=False):
        """
        P/B Valuation: Target Price = BVPS × Target P/B

        Args:
            target_pb: Target P/B ratio (if None, uses peer average)
            use_median: Use median instead of mean

        Returns:
            Dict with valuation results
        """
        bvps = self.financials["bvps"]
        if bvps is None or bvps <= 0:
            return {"method": "P/B", "error": "BVPS <= 0, cannot apply P/B"}

        if target_pb is None:
            target_pb = self._peer_median("pb") if use_median else self._peer_avg("pb")

        if target_pb is None:
            return {"method": "P/B", "error": "No target P/B available"}

        target_price = bvps * target_pb

        result = {
            "method": "P/B",
            "bvps": bvps,
            "target_pb": target_pb,
            "target_price": target_price,
            "peer_avg_pb": self._peer_avg("pb"),
            "peer_median_pb": self._peer_median("pb"),
        }

        if self.financials.get("current_price"):
            result["current_price"] = self.financials["current_price"]
            result["current_pb"] = self.financials.get("current_pb")
            result["upside_pct"] = (target_price / self.financials["current_price"] - 1) * 100

        self.results["pb"] = result
        return result

    def valuation_ev_ebitda(self, target_multiple=None, use_median=False):
        """
        EV/EBITDA Valuation:
            EV = EBITDA × Target Multiple
            Equity Value = EV - Net Debt
            Target Price = Equity Value / Shares

        Args:
            target_multiple: Target EV/EBITDA (if None, uses peer average)
            use_median: Use median instead of mean

        Returns:
            Dict with valuation results
        """
        ebitda = self.financials["ebitda"]
        shares = self.financials["shares"]
        net_debt = self.financials["net_debt"]

        if ebitda is None or ebitda <= 0:
            return {"method": "EV/EBITDA", "error": "EBITDA <= 0"}

        if target_multiple is None:
            target_multiple = (self._peer_median("ev_ebitda") if use_median
                               else self._peer_avg("ev_ebitda"))

        if target_multiple is None:
            return {"method": "EV/EBITDA", "error": "No target multiple available"}

        ev = ebitda * target_multiple
        equity_value = ev - net_debt
        target_price = equity_value / shares * 1000 if shares > 0 else 0

        result = {
            "method": "EV/EBITDA",
            "ebitda": ebitda,
            "target_multiple": target_multiple,
            "enterprise_value": ev,
            "net_debt": net_debt,
            "equity_value": equity_value,
            "target_price": target_price,
            "peer_avg_ev_ebitda": self._peer_avg("ev_ebitda"),
            "peer_median_ev_ebitda": self._peer_median("ev_ebitda"),
        }

        if self.financials.get("current_price"):
            result["current_price"] = self.financials["current_price"]
            result["current_ev_ebitda"] = self.financials.get("current_ev_ebitda")
            result["upside_pct"] = (target_price / self.financials["current_price"] - 1) * 100

        self.results["ev_ebitda"] = result
        return result

    def run_all(self, target_pe=None, target_pb=None, target_ev_ebitda=None):
        """
        Run all three valuation methods.

        Returns:
            Dict with all results and summary
        """
        pe_result = self.valuation_pe(target_pe)
        pb_result = self.valuation_pb(target_pb)
        ev_result = self.valuation_ev_ebitda(target_ev_ebitda)

        # Collect valid target prices
        prices = []
        for r in [pe_result, pb_result, ev_result]:
            if "target_price" in r and r["target_price"] > 0:
                prices.append(r["target_price"])

        summary = {
            "pe": pe_result,
            "pb": pb_result,
            "ev_ebitda": ev_result,
        }

        if prices:
            summary["fair_value_low"] = min(prices)
            summary["fair_value_high"] = max(prices)
            summary["fair_value_avg"] = sum(prices) / len(prices)

        self.results = summary
        return summary

    def generate_summary(self):
        """Generate formatted relative valuation summary."""
        if not self.results:
            return "No results. Run valuation methods first."

        lines = [
            f"Relative Valuation Summary - {self.company_name}",
            "=" * 60,
            "",
        ]

        # Peer table
        if self.peers:
            lines.append("Peer Comparison:")
            lines.append(f"  {'Company':<12} {'P/E':>8} {'P/B':>8} {'EV/EBITDA':>10}")
            lines.append("  " + "-" * 40)
            for name, data in self.peers.items():
                pe_str = f"{data.get('pe', '-'):>8.1f}" if data.get('pe') else f"{'—':>8}"
                pb_str = f"{data.get('pb', '-'):>8.1f}" if data.get('pb') else f"{'—':>8}"
                ev_str = f"{data.get('ev_ebitda', '-'):>10.1f}" if data.get('ev_ebitda') else f"{'—':>10}"
                lines.append(f"  {name:<12} {pe_str} {pb_str} {ev_str}")
            lines.append("")

        # Results
        methods = [
            ("P/E", "pe"),
            ("P/B", "pb"),
            ("EV/EBITDA", "ev_ebitda")
        ]

        lines.append("Valuation Results:")
        lines.append(f"  {'Method':<12} {'Multiple':>10} {'Target Price':>15}")
        lines.append("  " + "-" * 40)

        for label, key in methods:
            r = self.results.get(key, {})
            if "error" in r:
                lines.append(f"  {label:<12} {'N/A':>10} {'N/A':>15}  ({r['error']})")
            elif "target_price" in r:
                mult_key = {"pe": "target_pe", "pb": "target_pb", "ev_ebitda": "target_multiple"}[key]
                mult_val = r.get(mult_key, 0)
                lines.append(f"  {label:<12} {mult_val:>10.1f}x {r['target_price']:>14,.0f}")

        lines.append("")

        # Fair value range
        if "fair_value_avg" in self.results:
            lines.append("Fair Value Range:")
            lines.append(f"  Low:  {self.results['fair_value_low']:,.0f}")
            lines.append(f"  Avg:  {self.results['fair_value_avg']:,.0f}")
            lines.append(f"  High: {self.results['fair_value_high']:,.0f}")
            lines.append("")

        return "\n".join(lines)


# Example usage
if __name__ == "__main__":
    model = RelativeValuation("Example Corp")

    model.set_financials(
        eps=5000,
        bvps=30000,
        ebitda=500,
        net_debt=-200,
        cash=300,
        shares_outstanding=100,
        current_price=60000,
        net_income=500,
        book_value=3000,
    )

    model.set_peer_multiples({
        "Peer A": {"pe": 12, "pb": 2.5, "ev_ebitda": 8},
        "Peer B": {"pe": 15, "pb": 3.0, "ev_ebitda": 10},
        "Peer C": {"pe": 18, "pb": 2.0, "ev_ebitda": 12},
    })

    model.run_all()
    print(model.generate_summary())
