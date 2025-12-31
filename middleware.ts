import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Ne pas exécuter de code entre createServerClient et
    // supabase.auth.getUser(). Un simple appel peut avoir des conséquences
    // inattendues sur la gestion des sessions.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Rediriger vers login si l'utilisateur n'est pas connecté et essaie d'accéder au dashboard
    if (
        !user &&
        request.nextUrl.pathname.startsWith("/dashboard")
    ) {
        const url = request.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
    }

    // Rediriger vers dashboard si l'utilisateur est connecté et essaie d'accéder à login/signup
    if (
        user &&
        (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")
    ) {
        const url = request.nextUrl.clone()
        url.pathname = "/dashboard"
        return NextResponse.redirect(url)
    }

    // IMPORTANT: Toujours retourner l'objet supabaseResponse.
    // Si vous créez un nouvel objet NextResponse, assurez-vous de:
    // 1. Transmettre la requête: NextResponse.next({ request })
    // 2. Copier les cookies: supabaseResponse.cookies.getAll() vers le nouveau response
    // Sinon, les cookies de session seront perdus.

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match toutes les routes sauf:
         * - _next/static (fichiers statiques)
         * - _next/image (optimisation d'images)
         * - favicon.ico (icône)
         * - images et fichiers publics
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
