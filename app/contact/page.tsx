import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Mail, Phone, MapPin, ArrowLeft } from "lucide-react"

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
            {/* Header */}
            <header className="border-b border-border/50">
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

            {/* Content */}
            <main className="container mx-auto px-4 py-16">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
                    <p className="text-muted-foreground mb-12">
                        Have a question? Need help? Our team is here to assist you.
                    </p>

                    <div className="space-y-8">
                        {/* Phone */}
                        <div className="flex items-start gap-4 p-6 rounded-2xl bg-card border border-border/50">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Phone className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Phone</h3>
                                <a
                                    href="tel:+21699112120"
                                    className="text-lg text-primary hover:underline"
                                >
                                    +216 99 112 120
                                </a>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Monday to Friday, 9am - 6pm
                                </p>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-start gap-4 p-6 rounded-2xl bg-card border border-border/50">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Mail className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Email</h3>
                                <a
                                    href="mailto:hello@moocky.tech"
                                    className="text-lg text-primary hover:underline"
                                >
                                    hello@moocky.tech
                                </a>
                                <p className="text-sm text-muted-foreground mt-1">
                                    We respond within 24 hours
                                </p>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-start gap-4 p-6 rounded-2xl bg-card border border-border/50">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <MapPin className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Location</h3>
                                <p className="text-muted-foreground">
                                    Tunisia 🇹🇳
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-12 p-8 rounded-2xl bg-primary/5 text-center">
                        <h3 className="text-xl font-semibold mb-2">Ready to get started?</h3>
                        <p className="text-muted-foreground mb-6">
                            Create your free account and start managing your business.
                        </p>
                        <Link href="/signup">
                            <Button size="lg">
                                Create my account
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    )
}
