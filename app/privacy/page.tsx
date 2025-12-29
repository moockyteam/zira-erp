import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Shield, Database, Lock, Eye, UserCheck, Mail, Clock } from "lucide-react"

const sections = [
    { id: "collection", title: "Collection", icon: Database },
    { id: "usage", title: "Usage", icon: Eye },
    { id: "security", title: "Security", icon: Lock },
    { id: "rights", title: "Your Rights", icon: UserCheck },
    { id: "contact", title: "Contact", icon: Mail },
]

export default function PrivacyPage() {
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
                            <Shield className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
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

                    {/* Intro */}
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 mb-8">
                        <p className="text-center text-muted-foreground">
                            At <strong className="text-foreground">Moocky</strong>, protecting your data is our priority.
                            This policy explains how we collect, use, and protect your information.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="space-y-8">
                        {/* Section 1 - Collection */}
                        <section id="collection" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Database className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">Data Collected</h2>
                                </div>

                                <div className="grid sm:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-secondary/30">
                                        <h4 className="font-medium mb-3 flex items-center gap-2">
                                            <UserCheck className="w-4 h-4 text-primary" />
                                            Account
                                        </h4>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            <li>• First and last name</li>
                                            <li>• Email address</li>
                                            <li>• Password (encrypted)</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 rounded-xl bg-secondary/30">
                                        <h4 className="font-medium mb-3 flex items-center gap-2">
                                            <Database className="w-4 h-4 text-primary" />
                                            Business
                                        </h4>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            <li>• Customers / Suppliers</li>
                                            <li>• Invoices / Quotes</li>
                                            <li>• Inventory</li>
                                        </ul>
                                    </div>
                                    <div className="p-4 rounded-xl bg-secondary/30">
                                        <h4 className="font-medium mb-3 flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-primary" />
                                            Technical
                                        </h4>
                                        <ul className="text-sm text-muted-foreground space-y-1">
                                            <li>• IP address</li>
                                            <li>• Browser</li>
                                            <li>• Pages visited</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 2 - Usage */}
                        <section id="usage" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Eye className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">Data Usage</h2>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {[
                                        "Provide and improve the service",
                                        "Manage your authentication",
                                        "Technical support",
                                        "Important notifications",
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                                <span className="text-green-600 text-xs">✓</span>
                                            </div>
                                            <span className="text-sm">{item}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <strong className="text-amber-700 dark:text-amber-300">Important:</strong> We never sell your data.
                                </p>
                            </div>
                        </section>

                        {/* Section 3 - Security */}
                        <section id="security" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Lock className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">Security Measures</h2>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {[
                                        { icon: "🔒", text: "HTTPS encryption" },
                                        { icon: "🔐", text: "Hashed passwords" },
                                        { icon: "👥", text: "Restricted access" },
                                        { icon: "💾", text: "Regular backups" },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                            <span className="text-lg">{item.icon}</span>
                                            <span className="text-sm">{item.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Section 4 - Rights */}
                        <section id="rights" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-card border border-border/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <UserCheck className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">Your Rights</h2>
                                </div>
                                <div className="grid sm:grid-cols-3 gap-3">
                                    {[
                                        { title: "Access", desc: "View your data" },
                                        { title: "Rectify", desc: "Correct errors" },
                                        { title: "Delete", desc: "Erase your data" },
                                        { title: "Export", desc: "Download your data" },
                                        { title: "Restrict", desc: "Limit processing" },
                                        { title: "Object", desc: "Refuse certain uses" },
                                    ].map((item, i) => (
                                        <div key={i} className="p-3 rounded-xl bg-secondary/30 text-center">
                                            <div className="font-medium text-primary">{item.title}</div>
                                            <div className="text-xs text-muted-foreground">{item.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Compact sections */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-card border border-border/50 flex items-start gap-3">
                                <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold mb-1">Retention</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Data deleted 30 days after account closure.
                                    </p>
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl bg-card border border-border/50 flex items-start gap-3">
                                <Database className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold mb-1">Cookies</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Only essential cookies for authentication.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <section id="contact" className="scroll-mt-24">
                            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-semibold">Questions?</h2>
                                </div>
                                <p className="text-muted-foreground mb-4">
                                    To exercise your rights or for any questions:
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
                    </div>
                </div>
            </main>
        </div>
    )
}
