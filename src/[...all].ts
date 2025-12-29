export const get = ({ redirect }: { redirect: (url: string) => void }) => {
    const url: string = process.env.MAIN_WEBSITE_URL || "";
    if (!url?.length) return "OK"
    return redirect(url);
}