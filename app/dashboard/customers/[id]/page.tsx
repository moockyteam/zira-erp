
import { EditCustomerWrapper } from "./wrapper"

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <EditCustomerWrapper customerId={id} />
}
