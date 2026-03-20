'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface BasicInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: BasicInfoData) => void;
  initialData?: BasicInfoData;
}

export interface BasicInfoData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneCode: string;
  gender: string;
  dob: string;
  country: string;
  city: string;
  employment: string;
  passportNumber?: string;
}

export default function BasicInfoModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: BasicInfoModalProps) {
  const [firstNameValue, setFirstNameValue] = useState(initialData?.firstName || '');
  const [middleNameValue, setMiddleNameValue] = useState(initialData?.middleName || '');
  const [lastNameValue, setLastNameValue] = useState(initialData?.lastName || '');
  const [emailValue, setEmailValue] = useState(initialData?.email || '');
  const [phoneValue, setPhoneValue] = useState(initialData?.phone || '');
  const [phoneCode, setPhoneCode] = useState(initialData?.phoneCode || '+1 (USA)');
  const [genderValue, setGenderValue] = useState(initialData?.gender || '');
  const [dobValue, setDobValue] = useState(initialData?.dob || '');
  const [countryValue, setCountryValue] = useState(initialData?.country || '');
  const [cityValue, setCityValue] = useState(initialData?.city || '');
  const [employmentValue, setEmploymentValue] = useState(initialData?.employment || '');
  const [passportNumberValue, setPassportNumberValue] = useState(initialData?.passportNumber || '');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Update values when initialData changes
  useEffect(() => {
    if (initialData) {
      setFirstNameValue(initialData.firstName || '');
      setMiddleNameValue(initialData.middleName || '');
      setLastNameValue(initialData.lastName || '');
      setEmailValue(initialData.email || '');
      setPhoneValue(initialData.phone || '');
      setPhoneCode(initialData.phoneCode || '+1 (USA)');
      setGenderValue(initialData.gender || '');
      setDobValue(initialData.dob || '');
      setCountryValue(initialData.country || '');
      setCityValue(initialData.city || '');
      setEmploymentValue(initialData.employment || '');
      setPassportNumberValue(initialData.passportNumber || '');
    } else {
      // Clear all fields for "Add" mode
      setFirstNameValue('');
      setMiddleNameValue('');
      setLastNameValue('');
      setEmailValue('');
      setPhoneValue('');
      setPhoneCode('+1 (USA)');
      setGenderValue('');
      setDobValue('');
      setCountryValue('');
      setCityValue('');
      setEmploymentValue('');
      setPassportNumberValue('');
    }
  }, [initialData, isOpen]);

  const handleSave = () => {
    onSave({
      firstName: firstNameValue,
      middleName: middleNameValue,
      lastName: lastNameValue,
      email: emailValue,
      phone: phoneValue,
      phoneCode,
      gender: genderValue,
      dob: dobValue,
      country: countryValue,
      city: cityValue,
      employment: employmentValue,
      passportNumber: passportNumberValue,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="modal-placeholder-black bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">Edit Basic Information</h2>
            <button
              onClick={onClose}
              className="text-[#9095A1] hover:text-gray-600"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Name Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstNameValue}
                    onChange={(e) => setFirstNameValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                  />
                </div>

                {/* Middle Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={middleNameValue}
                    onChange={(e) => setMiddleNameValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastNameValue}
                    onChange={(e) => setLastNameValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                  />
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                    />
                    <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                      Verified
                    </button>
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="w-36 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white text-gray-900"
                    >
                      <option>+1 (USA)</option>
                      <option>+44 (UK)</option>
                      <option>+91 (India)</option>
                    </select>
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={(e) => setPhoneValue(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                    />
                  </div>
                </div>

                {/* Current City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current City
                  </label>
                  <input
                    type="text"
                    value={cityValue}
                    onChange={(e) => setCityValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                  />
                </div>

                {/* Employment Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Status
                  </label>
                  <select
                    value={employmentValue}
                    onChange={(e) => setEmploymentValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white text-gray-900"
                  >
                    <option value="">Select Status</option>
                    <option>Employed</option>
                    <option>Unemployed</option>
                    <option>Self-Employed</option>
                    <option>Student</option>
                  </select>
                </div>

                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={genderValue}
                    onChange={(e) => setGenderValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white text-gray-900"
                  >
                    <option value="">Select Gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <div
                      className="absolute left-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer"
                      onClick={() => dateInputRef.current?.showPicker()}
                    >
                      <Image
                        src="/calendar_icon.png"
                        alt="Calendar"
                        width={16}
                        height={16}
                        className="h-4 w-4"
                      />
                    </div>
                    <input
                      ref={dateInputRef}
                      type="text"
                      value={dobValue}
                      onChange={(e) => setDobValue(e.target.value)}
                      onClick={() => dateInputRef.current?.showPicker()}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                    />
                  </div>
                </div>

                {/* Current Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Country
                  </label>
                  <select
                    value={countryValue}
                    onChange={(e) => setCountryValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white text-gray-900"
                  >
                    <option value="">Select Country</option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>India</option>
                    <option>Canada</option>
                  </select>
                </div>

                {/* Passport Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passport Number
                  </label>
                  <input
                    type="text"
                    value={passportNumberValue}
                    onChange={(e) => setPassportNumberValue(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-900"
                    placeholder="Enter passport number"
                  />
                </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}