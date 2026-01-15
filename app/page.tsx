import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Receipt,
  Truck,
  Package,
  Users,
  CreditCard,
  ArrowRight,
  Globe,
  Shield,
  Calculator,
  Building2,
  CheckCircle2,
  Zap
} from "lucide-react"

const features = [
  {
    icon: FileText,
    title: "Invoices",
    description: "Create and manage professional invoices in just a few clicks"
  },
  {
    icon: Receipt,
    title: "Quotes",
    description: "Generate custom quotes and convert them into invoices"
  },
  {
    icon: Truck,
    title: "Delivery Notes",
    description: "Track your deliveries and manage shipments easily"
  },
  {
    icon: Package,
    title: "Inventory Management",
    description: "Control your stock in real-time"
  },
  {
    icon: Users,
    title: "Customers & Suppliers",
    description: "Centralize all your business contacts"
  },
  {
    icon: CreditCard,
    title: "Expense Tracking",
    description: "Master your expenses and optimize your cash flow"
  }
]

const highlights = [
  {
    icon: Globe,
    title: "Multilingual Documents",
    description: "Generate your invoices and quotes in French, Arabic, and English as needed",
    badge: "FR • AR • EN"
  },
  {
    icon: Shield,
    title: "Tunisian Tax Compliant",
    description: "19% VAT, Withholding tax, Stamp duty - everything is calculated automatically",
    badge: "100% Compliant"
  },
  {
    icon: Calculator,
    title: "Simplified Accounting",
    description: "Accounting journal, VAT tracking, and FEC export compliant with Tunisian standards",
    badge: "FEC Export"
  }
]

const advantages = [
  "French interface adapted to the Tunisian market",
  "Multi-currency support: TND, EUR, USD",
  "Automatic stamp duty on documents",
  "Built-in withholding tax management",
  "Compliant exports for your accountant",
  "Full support for Tunisian VAT rates"
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon-dark-32x32.png"
              alt="ZIRA"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              ZIRA
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-xs font-medium border border-red-500/20">
              🇹🇳 Tunisia
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#highlights" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Benefits
            </a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="shadow-lg shadow-primary/20">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Tunisia Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-600 text-sm font-medium mb-6 border border-red-500/20">
              <Building2 className="w-4 h-4" />
              Built for Tunisian businesses • <span className="font-bold">100% Free in 2026</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Business management{" "}
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                simplified for Tunisia
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              ZIRA is the management solution tailored for Tunisian businesses:
              multilingual invoices, local tax compliance, and simplified accounting.
            </p>

            {/* Language Pills */}
            <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border/50 text-sm">
                <span className="font-medium">Documents in:</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium border border-blue-500/20">
                🇫🇷 French
              </div>
              <div className="px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm font-medium border border-green-500/20">
                🇸🇦 Arabic
              </div>
              <div className="px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-600 text-sm font-medium border border-purple-500/20">
                🇬🇧 English
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto shadow-xl shadow-primary/25 text-base px-8">
                  Start for free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                  I already have an account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Section - Tunisia Focus */}
      <section id="highlights" className="py-16 lg:py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why choose ZIRA?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A solution designed and developed for the Tunisian context
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            {highlights.map((item, index) => (
              <div
                key={index}
                className="relative group p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300"
              >
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {item.badge}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Advantages List */}
          <div className="max-w-3xl mx-auto bg-card rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-xl font-bold">Tailored for the Tunisian market</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {advantages.map((advantage, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>{advantage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              All the essential features
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete suite of tools to efficiently manage your business
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 lg:py-28 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Special Offer 2026
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Access the full power of ZIRA completely free in 2026, or upgrade for enterprise controls.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="relative p-8 rounded-3xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/30 hover:border-primary/50 transition-all duration-300">
              {/* Popular Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg">
                Special Offer 2026
              </div>

              <div className="mb-6 mt-2">
                <h3 className="text-xl font-bold mb-2">Cloud Edition</h3>
                <p className="text-sm text-muted-foreground">Full access, zero cost</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold">0</span>
                  <span className="text-xl font-semibold text-muted-foreground">DT</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">100% Free during 2026</p>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited invoices & quotes",
                  "Inventory & Stock Management",
                  "Accounting & FEC export",
                  "Multi-user access",
                  "Cloud hosting included",
                  "Automatic updates",
                  "Community support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="block">
                <Button size="lg" className="w-full shadow-lg shadow-primary/20">
                  Start for Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="relative p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                <p className="text-sm text-muted-foreground">For custom needs & independence</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Contact us for a quote</p>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  "Dedicated environment deployment",
                  "Custom domain name",
                  "White-label options",
                  "Custom feature development",
                  "Priority support SLA",
                  "Data sovereignty",
                  "On-premise options available"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/contact" className="block">
                <Button variant="outline" size="lg" className="w-full">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>

          {/* Additional Info */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            All prices are in Tunisian Dinars (TND), excluding 19% VAT. No commitment, cancel anytime.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-12 md:p-16 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-500/20 rounded-full blur-3xl" />

            <div className="relative text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-primary-foreground text-sm font-medium mb-6">
                🇹🇳 Made for Tunisia
              </div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
                Ready to digitize your business?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                Join Tunisian businesses that trust ZIRA for their daily management.
              </p>
              <Link href="/signup">
                <Button size="lg" variant="secondary" className="text-base px-8 shadow-xl">
                  Create my free account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/icon-dark-32x32.png"
                alt="ZIRA"
                width={24}
                height={24}
                className="rounded"
              />
              <span className="font-bold text-foreground">ZIRA</span>
              <span className="text-muted-foreground text-sm">
                © {new Date().getFullYear()} Moocky • 🇹🇳 Tunisia
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
