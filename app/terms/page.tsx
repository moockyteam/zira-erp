import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, Shield, Users, Scale, Mail, AlertCircle } from "lucide-react"

const sections = [
    { id: "acceptance", title: "Acceptance", icon: FileText },
    { id: "service", title: "Service", icon: Shield },
    { id: "account", title: "Account", icon: Users },
    { id: "usage", title: "Usage", icon: Scale },
    { id: "contact", title: "Contact", icon: Mail },
]

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
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
                    </Link>
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="container mx-auto px-4 py-12">
                <div className="max-w-4xl mx-auto">
                    {/* Hero */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
                            <Scale className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
                        <p className="text-muted-foreground">
                            Last updated: {new Date().toLocaleDateString('en-US')}
                        </p>
                    </div>

                    {/* Quick Nav */}
                    <div className="flex flex-wrap justify-center gap-2 mb-12">
                        {sections.map((section) => (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 text-sm hover:bg-secondary transition-colors"
                            >
                                <section.icon className="w-4 h-4" />
                                {section.title}
                            </a>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="space-y-8">
                        {/* Section 1 */}
                        <section id="acceptance" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
                                </div>
                                <p className="text-muted-foreground leading-relaxed">
                                    By accessing and using ZIRA, you agree to be bound by these terms of service.
                                    If you do not accept these terms, please do not use our service.
                                </p>
                            </div>
                        </section>

                        {/* Section 2 */}
                        <section id="service" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Shield className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">2. Service Description</h2>
                                </div>
                                <p className="text-muted-foreground mb-4">
                                    ZIRA is a business management solution that allows you to:
                                </p>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {[
                                        "Create and manage invoices and quotes",
                                        "Manage delivery notes",
                                        "Track inventory and stock",
                                        "Manage customers and suppliers",
                                        "Track expenses",
                                        "Generate reports"
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Section 3 */}
                        <section id="account" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">3. User Account</h2>
                                </div>
                                <div className="space-y-4 text-muted-foreground">
                                    <p>
                                        To use ZIRA, you must create an account with accurate information.
                                        You are responsible for the confidentiality of your password.
                                    </p>
                                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-800 dark:text-amber-200">
                                            Protect your account. Never share your credentials.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 4 */}
                        <section id="usage" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Scale className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">4. Usage Rules</h2>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">✓ Allowed</h4>
                                        <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                                            <li>Lawful use</li>
                                            <li>Managing your business</li>
                                            <li>Exporting your data</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">✗ Prohibited</h4>
                                        <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                                            <li>Unauthorized access</li>
                                            <li>Fraudulent use</li>
                                            <li>Service disruption</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Additional sections in compact format */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-card border border-border/50">
                                <h3 className="font-semibold mb-2">5. Intellectual Property</h3>
                                <p className="text-sm text-muted-foreground">
                                    ZIRA and its content are protected by intellectual property rights.
                                </p>
                            </div>
                            <div className="p-5 rounded-2xl bg-card border border-border/50">
                                <h3 className="font-semibold mb-2">6. Your Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    You retain ownership of your data and can export it at any time.
                                </p>
                            </div>
                            <div className="p-5 rounded-2xl bg-card border border-border/50">
                                <h3 className="font-semibold mb-2">7. Liability</h3>
                                <p className="text-sm text-muted-foreground">
                                    The service is provided "as is". Our liability is limited.
                                </p>
                            </div>
                            <div className="p-5 rounded-2xl bg-card border border-border/50">
                                <h3 className="font-semibold mb-2">8. Modifications</h3>
                                <p className="text-sm text-muted-foreground">
                                    These terms may be modified. You will be notified of changes.
                                </p>
                            </div>
                        </div>

                        {/* Contact */}
                        <section id="contact" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">Contact</h2>
                                </div>
                                <p className="text-muted-foreground mb-4">
                                    For any questions regarding these terms:
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <a
                                        href="mailto:hello@moocky.tech"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card hover:bg-secondary transition-colors"
                                    >
                                        <Mail className="w-4 h-4" />
                                        hello@moocky.tech
                                    </a>
                                    <a
                                        href="tel:+21699112120"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card hover:bg-secondary transition-colors"
                                    >
                                        +216 99 112 120
                                    </a>
                                </div>
                            </div>
                        </section>

                        {/* Footer note */}
                        <p className="text-center text-sm text-muted-foreground">
                            These terms are governed by Tunisian law.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
