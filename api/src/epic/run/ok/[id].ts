export const get = ({ params }: { params: { id: string } }) => {
  return { user: params.id };
}; 