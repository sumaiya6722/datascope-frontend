"use client";

import { useParams } from "next/navigation";
import DatasetForm from "../../../../../components/dataset-form.js";

export default function EditDatasetPage() {
  const { datasetId } = useParams();
  return <DatasetForm datasetId={datasetId} />;
}
