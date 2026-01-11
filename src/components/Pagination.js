"use client";

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex justify-center items-center mt-4 space-x-2">
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="bg-blue-600 text-white rounded w-8 h-8 flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
        &lt;
      </button>
      <span className="text-gray-600">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="bg-blue-600 text-white rounded w-8 h-8 flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        &gt;
      </button>
    </div>
  );
}
