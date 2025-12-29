import { SignupForm } from "@/components/signup-form"
import Link from "next/link"

export default function SignupPage() {
    return (
        <div className="w-full">
            <SignupForm />

            {/* Login Link */}
            <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    )
}
