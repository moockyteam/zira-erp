import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = {
    title: "ZIRA - Authentication",
    description: "Sign in or create your ZIRA account",
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] bg-gradient-to-br from-primary via-primary/90 to-primary/80 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    {/* Logo */}
                    <Link href="/" className="inline-flex items-center gap-3">
                        <Image
                            src="/icon-dark-32x32.png"
                            alt="ZIRA"
                            width={48}
                            height={48}
                            className="rounded-xl"
                        />
                        <span className="text-3xl font-bold text-white">ZIRA</span>
                    </Link>

                    {/* Main Content */}
                    <div className="space-y-4">
                        <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                            Your simplified management
                        </h1>
                        <p className="text-white/70 max-w-sm">
                            Invoices, quotes, inventory and customers all in one place.
                        </p>
                    </div>

                    {/* Footer */}
                    <p className="text-sm text-white/50">
                        © {new Date().getFullYear()} ZIRA • 🇹🇳 Tunisia
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-background to-secondary/10 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />

                {/* Content */}
                <div className="relative z-10 w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2">
                            <Image
                                src="/icon-dark-32x32.png"
                                alt="ZIRA"
                                width={40}
                                height={40}
                                className="rounded-xl"
                            />
                            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                                ZIRA
                            </span>
                        </Link>
                    </div>

                    {children}
                </div>
            </div>
        </div>
    )
}
