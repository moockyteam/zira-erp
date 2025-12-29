import { LoginForm } from "@/components/login-form"
import Link from "next/link"

export default function LoginPage() {
    return (
        <div className="w-full">
            <LoginForm />

            {/* Signup Link */}
            <p className="text-center text-sm text-muted-foreground mt-6">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary font-medium hover:underline">
                    Create account
                </Link>
            </p>
        </div>
    )
}
