import { EditCustomerWrapper } from "./wrapper"

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
    console.log("Accessing EditCustomerPage with params promise...");
    const { id } = await params
    console.log("Resolved ID:", id);
    return <EditCustomerWrapper customerId={id} />
}
